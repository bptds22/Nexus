"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachAthletesMobile — Page "Mes athlètes" mobile-native (coach).

   Clone du recruteur recherche (carte AthleteCardMobile + grid
   2 colonnes + filtres bottom-sheet + pull-to-refresh), adapté :
   - 2 onglets : Roster (coach_id===me) | À réclamer (coach_id IS NULL).
   - Roster : grid/list, favorites count display-only (PAS de heart).
   - À réclamer : grid multi-select via checkbox, sticky action bar,
     bottom-sheet confirmation, UPDATE coach_id=me (RLS gated).
   - "À traiter" : déplacé dans la tab bar (route /coach/a-traiter),
     PAS d'onglet ici.

   Réutilise AthleteCardMobile via props optionnelles backward-compat :
   favoritesCount (roster) · selected + onToggleSelect (claim) ·
   profileHref + layoutIdPrefix ("coach-athlete-photo").

   Réf. data layer : app/coach/athletes/page.tsx L241-310 (query +
   favorites count). Réf. claim : ReclamerSection.tsx + migration
   20260428050000 (RLS coach_id IS NULL → auth.uid()).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { AthleteCardMobile } from "@/components/shared/RecruteurRechercheMobile";
import { MobilePicker, type PickerOption } from "@/components/mobile/MobilePicker";
import { useMobileToast } from "@/components/mobile/MobileToast";
import AthletePhoto from "@/components/shared/AthletePhoto";
import { isValidationExpired } from "@/lib/utils/profileValidation";
import { parseDistinctions } from "@/lib/config/badges";
import { selectBestEvaluation } from "@/lib/evaluations/selectEvaluation";
import { TEAM_GENDER_FILTER_OPTIONS, firstTeamGender } from "@/lib/config/gender";
import {
  lookupInvitableByEmail,
  type AthleteEmailSuggestion,
} from "@/lib/coach/athleteEmailAutocomplete";
import { createAthleteInvitationLink } from "@/lib/queries/coach/createAthleteInvitation";
import { loadCoachTeams, inviteAthleteToTeam, type CoachTeamOption } from "@/lib/queries/coach/teamInvite";

/* ── Constants ────────────────────────────────────────────── */

const SPORTS: PickerOption[] = [
  { value: "", label: "Tous les sports" },
  { value: "football", label: "Football" },
  { value: "basketball", label: "Basketball" },
  { value: "soccer", label: "Soccer" },
  { value: "hockey", label: "Hockey" },
  { value: "volleyball", label: "Volleyball" },
  { value: "athlétisme", label: "Athlétisme" },
  { value: "badminton", label: "Badminton" },
  { value: "baseball", label: "Baseball" },
  { value: "cheerleading", label: "Cheerleading" },
  { value: "cross-country", label: "Cross-country" },
  { value: "flag_football", label: "Flag football" },
  { value: "futsal", label: "Futsal" },
  { value: "natation", label: "Natation" },
  { value: "rugby", label: "Rugby" },
  { value: "ultimate_frisbee", label: "Ultimate frisbee" },
  { value: "autre", label: "Autre" },
];

const PROMOTION_OPTIONS: PickerOption[] = [
  { value: "", label: "Toutes les promotions" },
  { value: "2026", label: "Promotion 2026" },
  { value: "2027", label: "Promotion 2027" },
  { value: "2028", label: "Promotion 2028" },
];

const GPA_OPTIONS: PickerOption[] = [
  { value: "", label: "Aucun minimum" },
  { value: "60", label: "60 %+" },
  { value: "70", label: "70 %+" },
  { value: "80", label: "80 %+" },
  { value: "85", label: "85 %+" },
  { value: "90", label: "90 %+" },
];

const SORT_OPTIONS: PickerOption[] = [
  { value: "rating_desc", label: "Meilleure cote" },
  { value: "rating_asc", label: "Cote croissante" },
  { value: "favorites_desc", label: "Plus favorisés" },
  { value: "grad_asc", label: "Graduation proche" },
  { value: "grad_desc", label: "Graduation éloignée" },
  { value: "name_asc", label: "Nom A-Z" },
];

/* ── Types ────────────────────────────────────────────────── */

export interface CoachAthlete {
  id: string;
  firstName: string;
  lastName: string;
  photo: string;
  position: string;
  sportName: string;
  sport: string;
  school: string;
  region: string;
  graduationYear: number;
  stars: number;
  isVerified: boolean;
  lastValidation: string | null;
  jersey: string;
  recruitmentStatus: string;
  committedSchoolName: string | null;
  openToOffers: boolean | null;
  noTeam: boolean;
  /** Genre de l'ÉQUIPE (teams.gender), jamais athletes.genre. null si sans équipe. */
  teamGender: string | null;
  coachId: string | null;
  favoritesCount: number;
  hasVideo: boolean;
  gpa: number;
  hasDistinction: boolean;
  hasAcademicBadge: boolean;
  createdAt: string;
}

/* ── Helpers ──────────────────────────────────────────────── */

async function triggerHaptic(intensity: "Light" | "Medium" = "Light") {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style = intensity === "Light" ? ImpactStyle.Light : ImpactStyle.Medium;
    await Haptics.impact({ style });
  } catch { /* no-op */ }
}

function mapCoachAthlete(a: Record<string, unknown>, favCounts: Record<string, number>): CoachAthlete {
  const posRaw = a.positions;
  const pos = Array.isArray(posRaw) ? posRaw[0] : posRaw;
  const posObj = pos as { nom?: string; abreviation?: string } | null;

  const sportRaw = a.sports;
  const sportJoin = Array.isArray(sportRaw) ? sportRaw[0] : sportRaw;
  const sportObj = sportJoin as { nom?: string } | null;

  const schoolRaw = a.schools;
  const school = Array.isArray(schoolRaw) ? schoolRaw[0] : schoolRaw;
  const schoolObj = school as { name?: string; region?: string } | null;

  const committedSchoolRaw = a.committed_school;
  const committedSchool = (Array.isArray(committedSchoolRaw) ? committedSchoolRaw[0] : committedSchoolRaw) as { name?: string } | null;

  const evalsRaw = a.evaluations;
  const evals = Array.isArray(evalsRaw) ? evalsRaw : [];
  const eval0 = selectBestEvaluation(evals) as { cote_globale?: number; distinctions?: unknown } | undefined;
  const starsRaw = (eval0?.cote_globale ?? (a.cote_globale_entraineur as number) ?? 0) as number;
  const stars = Math.round(starsRaw * 10) / 10;
  const distinctions = parseDistinctions(eval0?.distinctions);

  const teamAthletes = Array.isArray(a.team_athletes) ? a.team_athletes : [];
  const noTeam = teamAthletes.length === 0;
  const teamGender = firstTeamGender(teamAthletes);

  const academicBadges = (a.mentions_academiques as string[]) || [];
  const sportSlug = (sportObj?.nom || "").toLowerCase().replace(/ /g, "_");

  const id = a.id as string;

  return {
    id,
    firstName: (a.first_name as string) || "",
    lastName: (a.last_name as string) || "",
    photo: (a.photo_url as string) || "",
    position: posObj?.abreviation || posObj?.nom || "",
    sportName: sportObj?.nom || "",
    sport: sportSlug,
    school: schoolObj?.name || "",
    region: schoolObj?.region || "",
    graduationYear: (a.annee_diplomation as number) || 0,
    stars,
    isVerified: !!a.verified,
    lastValidation: (a.last_profile_validation as string) || null,
    jersey: a.numero_jersey != null ? String(a.numero_jersey) : "",
    recruitmentStatus: (a.recruitment_status as string) || (a.statut_recrutement_override as string) || "OUVERT",
    committedSchoolName: committedSchool?.name || null,
    openToOffers: (a.open_to_offers as boolean | null) ?? null,
    noTeam,
    teamGender,
    coachId: (a.coach_id as string | null) ?? null,
    favoritesCount: favCounts[id] || 0,
    hasVideo: !!a.video_faits_saillants_url,
    gpa: (a.moyenne_generale as number) || 0,
    hasDistinction: distinctions.length > 0,
    hasAcademicBadge: academicBadges.length > 0,
    createdAt: (a.created_at as string) || "",
  };
}

/* Adapter — projette CoachAthlete sur la shape attendue par
   AthleteCardMobile. isFavorited est ignoré côté coach (les props
   coach prennent le dessus dans la carte). */
function cardData(a: CoachAthlete) {
  return {
    id: a.id,
    firstName: a.firstName,
    lastName: a.lastName,
    photo: a.photo,
    position: a.position,
    sportName: a.sportName,
    school: a.school,
    graduationYear: a.graduationYear,
    stars: a.stars,
    isVerified: a.isVerified,
    lastValidation: a.lastValidation,
    isFavorited: false,
    jersey: a.jersey,
    recruitmentStatus: a.recruitmentStatus,
    committedSchoolName: a.committedSchoolName,
    openToOffers: a.openToOffers,
    noTeam: a.noTeam,
  };
}

/* ── MobileSearchBar (inline — no autocomplete overlay) ────── */

function MobileSearchBar({
  search, onSearchChange, activeFiltersCount, onOpenFilters, scrolled,
  viewMode, onToggleViewMode, showViewToggle,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  activeFiltersCount: number;
  onOpenFilters: () => void;
  scrolled: boolean;
  /** Iter 2b — single view-toggle button (replaces le segmented). Icône =
   *  mode vers lequel on bascule (iOS canon : list icon en grid, grid icon
   *  en list). Hidden quand showViewToggle === false (ex. tab À réclamer). */
  viewMode?: "grid" | "list";
  onToggleViewMode?: () => void;
  showViewToggle?: boolean;
}) {
  return (
    <div
      className="sticky top-0 z-30 px-4 pb-3 nx-safe-top"
      style={{
        backgroundColor: scrolled ? "rgba(17,19,23,0.85)" : "#111317",
        backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
        borderBottom: scrolled ? "0.5px solid rgba(255,255,255,0.08)" : "0.5px solid transparent",
        transition: "background-color 200ms ease-out, backdrop-filter 200ms ease-out, border-bottom-color 200ms ease-out",
      }}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-2xl bg-[#1A1D24] px-4 h-11 flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            inputMode="search"
            placeholder="Rechercher un athlète…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-[16px] text-white placeholder:text-[#6B7280] outline-none"
          />
          {search.length > 0 && (
            <button type="button" onClick={() => onSearchChange("")} className="text-[#6B7280] active:text-white" aria-label="Effacer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18" /><path d="M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {showViewToggle && onToggleViewMode && (
          <button
            type="button"
            onClick={() => { triggerHaptic("Light"); onToggleViewMode(); }}
            className="w-11 h-11 rounded-full bg-[#1A1D24] flex items-center justify-center active:bg-white/5"
            aria-label={viewMode === "grid" ? "Vue liste" : "Vue grille"}
          >
            {viewMode === "grid" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round">
                <path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => { triggerHaptic("Light"); onOpenFilters(); }}
          className="relative w-11 h-11 rounded-full bg-[#1A1D24] flex items-center justify-center active:bg-white/5"
          aria-label="Filtres"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
          </svg>
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E63946] text-white text-[10px] font-bold flex items-center justify-center">
              {activeFiltersCount > 9 ? "9+" : activeFiltersCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

/* ── FilterRow / TogglePill (iOS Settings style) ──────────── */

function FilterRow({
  label, value, onTap, disabled, disabledReason,
}: {
  label: string;
  value: string;
  onTap: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => { if (!disabled) { triggerHaptic("Light"); onTap(); } }}
      disabled={disabled}
      className={`flex items-center justify-between w-full px-4 py-3.5 border-b border-white/[0.06] last:border-b-0 text-left ${disabled ? "opacity-40" : "active:bg-white/[0.03]"} transition-colors`}
    >
      <span className="text-[15px] text-white/95 font-medium">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[14px] text-white/50 truncate max-w-[180px]">
          {disabled && disabledReason ? disabledReason : value}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-white/30">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </button>
  );
}

function TogglePill({ active, label, onTap }: { active: boolean; label: string; onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={() => { triggerHaptic("Light"); onTap(); }}
      className={`nx-mobile-touch-min inline-flex items-center gap-1.5 px-4 rounded-full text-[12px] font-bold transition-colors ${
        active
          ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30"
          : "bg-[#0C0E12] text-[#9CA3AF] border border-transparent"
      }`}
    >
      {label}
    </button>
  );
}

/* ── FiltersBottomSheet (pruned for coach) ────────────────── */

interface FiltersBottomSheetProps {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  resultCount: number;
  sport: string; setSport: (v: string) => void;
  /** Genre de l'ÉQUIPE (teams.gender) — pas athletes.genre. */
  genderFilter: string; setGenderFilter: (v: string) => void;
  position: string; setPosition: (v: string) => void;
  promotion: string; setPromotion: (v: string) => void;
  region: string; setRegion: (v: string) => void;
  minGpa: string; setMinGpa: (v: string) => void;
  sortBy: string; setSortBy: (v: string) => void;
  verifiedOnly: boolean; setVerifiedOnly: (v: boolean) => void;
  withVideoOnly: boolean; setWithVideoOnly: (v: boolean) => void;
  withSportBadge: boolean; setWithSportBadge: (v: boolean) => void;
  withAcademicBadge: boolean; setWithAcademicBadge: (v: boolean) => void;
  minRating: string; setMinRating: (v: string) => void;
  positionOptions: PickerOption[];
  regionOptions: PickerOption[];
}

function FiltersBottomSheet(props: FiltersBottomSheetProps) {
  const { open, onClose, onReset, resultCount } = props;
  const [mounted, setMounted] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const [openSport, setOpenSport] = useState(false);
  const [openGender, setOpenGender] = useState(false);
  const [openPosition, setOpenPosition] = useState(false);
  const [openPromotion, setOpenPromotion] = useState(false);
  const [openRegion, setOpenRegion] = useState(false);
  const [openGpa, setOpenGpa] = useState(false);
  const [openSort, setOpenSort] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!open) { setDragOffset(0); setIsDragging(false); } }, [open]);

  if (!mounted || !open) return null;
  let handleStartY = 0;
  const closeSheet = () => { triggerHaptic("Light"); onClose(); };

  const sportLabel = SPORTS.find((s) => s.value === props.sport)?.label || "Tous les sports";
  const genderLabelValue = TEAM_GENDER_FILTER_OPTIONS.find((g) => g.value === props.genderFilter)?.label || "Tous";
  const positionLabel = props.positionOptions.find((p) => p.value === props.position)?.label || "Toutes les positions";
  const promotionLabel = PROMOTION_OPTIONS.find((p) => p.value === props.promotion)?.label || "Toutes les promotions";
  const regionLabel = props.regionOptions.find((r) => r.value === props.region)?.label || "Toutes les régions";
  const gpaLabel = GPA_OPTIONS.find((g) => g.value === props.minGpa)?.label || "Aucun minimum";
  const sortLabel = SORT_OPTIONS.find((s) => s.value === props.sortBy)?.label || "Meilleure cote";

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[60]"
        style={{
          background: `rgba(0,0,0,${Math.max(0.2, 0.6 - dragOffset / 300)})`,
          animation: isDragging ? undefined : "nx-coach-modal-fade 200ms ease-out forwards",
        }}
        onClick={closeSheet}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[60] bg-[#1A1D24] rounded-t-2xl shadow-2xl flex flex-col"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          maxHeight: "90vh",
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? "none" : "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          animation: isDragging || dragOffset > 0 ? undefined : "nx-coach-modal-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        <div
          onTouchStart={(e) => { setIsDragging(true); handleStartY = e.touches[0].clientY; }}
          onTouchMove={(e) => {
            if (!isDragging && handleStartY === 0) return;
            const dy = Math.max(0, e.touches[0].clientY - handleStartY);
            setDragOffset(dy);
          }}
          onTouchEnd={() => {
            if (dragOffset > 100) closeSheet();
            else setDragOffset(0);
            setIsDragging(false); handleStartY = 0;
          }}
        >
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>
          <div className="px-5 pb-3 flex items-center justify-between border-b border-white/[0.06]">
            <button type="button" onClick={closeSheet} className="text-[#E63946] text-[15px] font-medium">Annuler</button>
            <span className="text-[15px] font-bold text-white">Filtres</span>
            <button type="button" onClick={() => { triggerHaptic("Light"); onReset(); }} className="text-[#9CA3AF] text-[14px]">Réinitialiser</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          <div className="mx-4 bg-[#1A1D24] rounded-2xl overflow-hidden">
            <FilterRow label="Sport" value={sportLabel} onTap={() => setOpenSport(true)} />
            <FilterRow label="Genre d'équipe" value={genderLabelValue} onTap={() => setOpenGender(true)} />
            <FilterRow
              label="Position"
              value={positionLabel}
              onTap={() => setOpenPosition(true)}
              disabled={!props.sport}
              disabledReason="Sélectionne un sport d'abord"
            />
            <FilterRow label="Promotion" value={promotionLabel} onTap={() => setOpenPromotion(true)} />
            <FilterRow label="Région" value={regionLabel} onTap={() => setOpenRegion(true)} />
            <FilterRow label="GPA minimum" value={gpaLabel} onTap={() => setOpenGpa(true)} />
            <FilterRow label="Trier par" value={sortLabel} onTap={() => setOpenSort(true)} />
          </div>

          <section className="px-4">
            <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B7280] mb-3">Critères rapides</h3>
            <div className="flex flex-wrap gap-2">
              <TogglePill active={props.verifiedOnly} label="Vérifié" onTap={() => props.setVerifiedOnly(!props.verifiedOnly)} />
              <TogglePill active={props.withVideoOnly} label="Avec vidéo" onTap={() => props.setWithVideoOnly(!props.withVideoOnly)} />
              <TogglePill active={props.minRating === "4"} label="4+ étoiles" onTap={() => props.setMinRating(props.minRating === "4" ? "" : "4")} />
              <TogglePill active={props.withSportBadge} label="Distinction" onTap={() => props.setWithSportBadge(!props.withSportBadge)} />
              <TogglePill active={props.withAcademicBadge} label="Mention académique" onTap={() => props.setWithAcademicBadge(!props.withAcademicBadge)} />
            </div>
          </section>
        </div>

        <div className="border-t border-white/[0.06] p-4">
          <button
            type="button"
            onClick={closeSheet}
            className="w-full h-14 rounded-2xl bg-[#E63946] text-white text-[15px] font-bold active:bg-[#D42B22]"
          >
            Appliquer{resultCount > 0 ? ` (${resultCount} athlète${resultCount !== 1 ? "s" : ""})` : ""}
          </button>
        </div>
      </div>

      <MobilePicker open={openSport} onClose={() => setOpenSport(false)} title="Sport" options={SPORTS} value={props.sport} onChange={(v) => props.setSport((v as string) ?? "")} />
      <MobilePicker open={openGender} onClose={() => setOpenGender(false)} title="Genre d'équipe" options={TEAM_GENDER_FILTER_OPTIONS} value={props.genderFilter} onChange={(v) => props.setGenderFilter((v as string) ?? "")} />
      <MobilePicker open={openPosition} onClose={() => setOpenPosition(false)} title="Position" options={props.positionOptions} value={props.position} onChange={(v) => props.setPosition((v as string) ?? "")} />
      <MobilePicker open={openPromotion} onClose={() => setOpenPromotion(false)} title="Promotion" options={PROMOTION_OPTIONS} value={props.promotion} onChange={(v) => props.setPromotion((v as string) ?? "")} />
      <MobilePicker open={openRegion} onClose={() => setOpenRegion(false)} title="Région" options={props.regionOptions} value={props.region} onChange={(v) => props.setRegion((v as string) ?? "")} />
      <MobilePicker open={openGpa} onClose={() => setOpenGpa(false)} title="GPA minimum" options={GPA_OPTIONS} value={props.minGpa} onChange={(v) => props.setMinGpa((v as string) ?? "")} />
      <MobilePicker open={openSort} onClose={() => setOpenSort(false)} title="Trier par" options={SORT_OPTIONS} value={props.sortBy} onChange={(v) => props.setSortBy((v as string) ?? "rating_desc")} />

      <style jsx>{`
        @keyframes nx-coach-modal-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nx-coach-modal-slideup { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>,
    document.body,
  );
}

/* ── ConfirmClaimSheet (bottom-sheet pattern) ─────────────── */

function ConfirmClaimSheet({
  open, onCancel, onConfirm, count, submitting,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  count: number;
  submitting: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || !open) return null;
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
        onClick={() => { if (!submitting) onCancel(); }}
        style={{ animation: "nx-coach-modal-fade 200ms ease-out forwards" }}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[70] bg-[#1A1D24] rounded-t-2xl shadow-2xl"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          animation: "nx-coach-confirm-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="px-6 pb-6">
          <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight text-center">
            Réclamer {count} athlète{count > 1 ? "s" : ""}?
          </h3>
          <p className="text-[13px] text-[#9CA3AF] mt-2 leading-relaxed text-center">
            Tu vas devenir le coach principal de {count} athlète{count > 1 ? "s" : ""}. Cette action peut être annulée plus tard.
          </p>
          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="flex-1 h-12 rounded-2xl bg-[#0C0E12] text-[#9CA3AF] text-[14px] font-bold active:bg-white/5 disabled:opacity-40"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting}
              className="flex-1 h-12 rounded-2xl bg-[#E63946] text-white text-[14px] font-bold active:bg-[#D42B22] disabled:opacity-40"
            >
              {submitting ? "…" : "Confirmer"}
            </button>
          </div>
        </div>
        <style jsx>{`
          @keyframes nx-coach-confirm-slideup { from { transform: translateY(100%); } to { transform: translateY(0); } }
        `}</style>
      </div>
    </>,
    document.body,
  );
}

/* ── CoachAthleteRowMobile (list view) ─────────────────────────
   Exported : single source of truth for the compact mobile athlete
   card. Reused by CoachEquipeDetailMobile's Athlètes section so the
   row matches /coach/athletes 1:1 (avatar + name + position/school
   + cote stars + grad year), wrapped in <SwipeableRow> for the
   swipe-to-remove gesture. */

export function CoachAthleteRowMobile({ a, onTap }: { a: CoachAthlete; onTap: () => void }) {
  const verifiedActive = a.isVerified && !isValidationExpired({ verified: !!a.isVerified, last_profile_validation: a.lastValidation });
  return (
    <button
      type="button"
      onClick={() => { triggerHaptic("Light"); onTap(); }}
      className="w-full text-left flex items-center gap-3 p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors"
    >
      <motion.div
        layoutId={`coach-athlete-photo-${a.id}`}
        className="relative w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-[#2F3440]"
      >
        <AthletePhoto photoUrl={a.photo} firstName={a.firstName} lastName={a.lastName} size={64} />
        {verifiedActive && (
          <div className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#3B82F6]/20 backdrop-blur-sm flex items-center justify-center border border-[#111317]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </motion.div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-[14px] truncate leading-tight">
          {a.firstName} {a.lastName}
        </p>
        <p className="text-[11px] text-[#9CA3AF] truncate mt-0.5">
          {a.position || a.sportName || "—"} · {a.noTeam ? "Ligue civile" : a.school || "—"}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="text-[11px] font-bold text-white">{a.stars.toFixed(1)}</span>
          </div>
          <span className="text-[#4a4d56]">·</span>
          <span className="text-[10px] uppercase text-[#6B7280]">{a.graduationYear || "—"}</span>
          {a.favoritesCount > 0 && (
            <>
              <span className="text-[#4a4d56]">·</span>
              <div className="flex items-center gap-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#E63946" stroke="none">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                </svg>
                <span className="text-[10px] font-bold text-[#E63946]">{a.favoritesCount}</span>
              </div>
            </>
          )}
        </div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2.5" strokeLinecap="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

/* ── SkeletonGrid ─────────────────────────────────────────── */

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden bg-[#1A1D24]" style={{ aspectRatio: "4 / 5" }}>
          <div className="w-full h-full nx-pulse-skel" />
        </div>
      ))}
      <style jsx>{`
        @keyframes nx-pulse-skel-kf { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.65; } }
        .nx-pulse-skel { background: #0C0E12; animation: nx-pulse-skel-kf 1.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

/* ── FabActionSheet — choix Ajouter / Inviter par courriel ──── */
function FabActionSheet({
  open, onClose, onAdd, onInvite,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: () => void;
  onInvite: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || !open) return null;
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: "nx-modal-fade 200ms ease-out forwards" }}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[70] bg-[#1A1D24] rounded-t-2xl shadow-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)", animation: "nx-modal-slideup 280ms cubic-bezier(0.34,1.56,0.64,1) forwards" }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
        <div className="px-6 pb-6 space-y-3">
          <button
            type="button"
            onClick={() => { triggerHaptic("Medium"); onAdd(); }}
            className="w-full h-14 rounded-2xl bg-[#E63946] text-white text-[14px] font-bold active:bg-[#D42B22] flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
            Ajouter un athlète
          </button>
          <button
            type="button"
            onClick={() => { triggerHaptic("Light"); onInvite(); }}
            className="w-full h-14 rounded-2xl border border-[#2D3748] text-white text-[14px] font-bold active:bg-white/5 flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 6l-10 7L2 6" /></svg>
            Inviter par courriel
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

/* ── InviteByEmailSheet — email → lookup orphelin exact → invite ─ */
const INVITE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function InviteByEmailSheet({
  open, onClose, onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: (message: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [email, setEmail] = useState("");
  const [looking, setLooking] = useState(false);
  const [match, setMatch] = useState<AthleteEmailSuggestion | null>(null);
  const [notInvitable, setNotInvitable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [teams, setTeams] = useState<CoachTeamOption[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setEmail(""); setMatch(null); setNotInvitable(false); setErrMsg(null);
      setSubmitting(false); setLooking(false); setTeamId(null);
      return;
    }
    (async () => {
      const t = await loadCoachTeams(createClient());
      setTeams(t);
      if (t.length === 1) setTeamId(t[0].id);
    })();
  }, [open]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMatch(null); setNotInvitable(false); setErrMsg(null);
    const e = email.trim().toLowerCase();
    if (!INVITE_EMAIL_RE.test(e)) { setLooking(false); return; }
    setLooking(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await lookupInvitableByEmail(createClient(), e);
        const exact = res.suggestions.find((s) => s.email.toLowerCase() === e) ?? null;
        setMatch(exact); setNotInvitable(!exact && res.existsNotInvitable);
      } catch { setNotInvitable(false); }
      finally { setLooking(false); }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [email]);

  const handleInvite = useCallback(async () => {
    if (!match || submitting) return;
    setSubmitting(true); setErrMsg(null);
    const supabase = createClient();
    if (match.hasAccount) {
      // Compte existant → invitation d'équipe in-app (team_invitations).
      if (!teamId) { setErrMsg("Choisis une équipe."); setSubmitting(false); return; }
      const res = await inviteAthleteToTeam(supabase, match.athleteId, teamId);
      setSubmitting(false);
      if (res.error) { setErrMsg(res.error); return; }
      onInvited(`Invitation d'équipe envoyée à ${match.firstName} ${match.lastName}.`);
    } else {
      // Orphelin sans compte → email de claim (email CANONIQUE, anti-typo).
      const res = await createAthleteInvitationLink(supabase, match.athleteId, match.email);
      setSubmitting(false);
      if (res.error) { setErrMsg(res.error); return; }
      onInvited(`Invitation envoyée à ${match.email}.`);
    }
  }, [match, submitting, teamId, onInvited]);

  if (!mounted || !open) return null;
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
        onClick={() => { if (!submitting) onClose(); }}
        style={{ animation: "nx-modal-fade 200ms ease-out forwards" }}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[70] bg-[#1A1D24] rounded-t-2xl shadow-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)", animation: "nx-modal-slideup 280ms cubic-bezier(0.34,1.56,0.64,1) forwards" }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
        <div className="px-6 pb-6">
          <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">Inviter par courriel</h3>
          <p className="text-[13px] text-[#9CA3AF] mt-1 mb-4">Le courriel d&apos;un athlète à inviter.</p>
          <input
            type="email" inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false}
            value={email} onChange={(e) => setEmail(e.target.value)} placeholder="athlete@exemple.ca"
            className="w-full bg-[#111317] border border-white/10 rounded-xl px-4 py-3 text-[16px] text-white placeholder:text-white/35 outline-none focus:border-[#E63946]/50"
          />
          <div className="mt-4 min-h-[60px]">
            {looking && <p className="text-[13px] text-[#9CA3AF]">Recherche…</p>}

            {/* État 1 : invitable → carte + invite (route has_account) */}
            {!looking && match && (
              <div className="bg-[#111317] border border-[#2D3748] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-white truncate">{match.firstName} {match.lastName}</p>
                    <p className="text-[13px] text-[#9CA3AF] truncate">{match.sportName || "—"} · {match.email}</p>
                  </div>
                  <button
                    type="button" onClick={handleInvite}
                    disabled={submitting || (match.hasAccount && !teamId && teams.length !== 1)}
                    className="shrink-0 h-11 px-4 rounded-2xl bg-[#E63946] text-white text-[13px] font-bold active:bg-[#D42B22] disabled:opacity-40"
                  >
                    {submitting ? "…" : "Inviter"}
                  </button>
                </div>
                {match.hasAccount && teams.length > 1 && (
                  <select value={teamId ?? ""} onChange={(e) => setTeamId(e.target.value || null)}
                    className="w-full bg-[#111317] border border-white/10 rounded-xl px-4 py-3 text-[16px] text-white outline-none focus:border-[#E63946]/50" title="Équipe">
                    <option value="">Choisis une équipe</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
                {match.hasAccount && teams.length === 1 && (
                  <p className="text-[13px] text-[#9CA3AF]">Équipe : <span className="text-white font-semibold">{teams[0].name}</span></p>
                )}
                {match.hasAccount && teams.length === 0 && (
                  <p className="text-[13px] text-[#F59E0B]">Aucune équipe — crées-en une dans « Mes équipes ».</p>
                )}
                {match.hasAccount && (
                  <p className="text-[12px] text-[#6b7280]">Compte existant → invitation d&apos;équipe (in-app).</p>
                )}
              </div>
            )}

            {/* État 2 : existe mais NON-invitable (zéro PII) */}
            {!looking && !match && notInvitable && (
              <p className="text-[13px] text-[#9CA3AF]">Cet athlète est déjà rattaché à une équipe et ne peut pas être invité ici.</p>
            )}

            {/* État 3 : inexistant */}
            {!looking && !match && !notInvitable && INVITE_EMAIL_RE.test(email.trim().toLowerCase()) && (
              <p className="text-[13px] text-[#9CA3AF]">Aucun athlète à ce courriel. Crée-le d&apos;abord, puis invite-le.</p>
            )}

            {errMsg && <p className="text-[13px] text-[#EF4444] font-semibold mt-2">{errMsg}</p>}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */

export function CoachAthletesMobile() {
  const router = useRouter();
  const toast = useMobileToast();
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  // SSR/hydration gate pour le createPortal du FAB (document.body absent au
  // prerender de l'export statique — sinon ReferenceError au build).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Data state
  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);

  // Tab
  const [activeTab, setActiveTab] = useState<"roster" | "reclamer">("roster");

  // Filters
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("");
  // Genre d'ÉQUIPE (teams.gender), PAS athletes.genre.
  const [genderFilter, setGenderFilter] = useState<string>("");
  const [position, setPosition] = useState("");
  const [promotion, setPromotion] = useState("");
  const [region, setRegion] = useState("");
  const [minGpa, setMinGpa] = useState("");
  const [sortBy, setSortBy] = useState("rating_desc");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [withVideoOnly, setWithVideoOnly] = useState(false);
  const [minRating, setMinRating] = useState("");
  const [withSportBadge, setWithSportBadge] = useState(false);
  const [withAcademicBadge, setWithAcademicBadge] = useState(false);

  // UI
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [scrollY, setScrollY] = useState(0);

  // Claim
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Positions dynamiques (par sport sélectionné)
  const [dynamicPositions, setDynamicPositions] = useState<{ abbr: string; label: string }[]>([]);

  /* ── Load athletes ── */
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }
      setCurrentUserId(user.id);

      const { data: coachRow, error: coachError } = await supabase
        .from("users")
        .select("school_id")
        .eq("id", user.id)
        .single();

      if (coachError || !coachRow?.school_id) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("athletes")
        .select(`
          id,
          photo_url,
          first_name,
          last_name,
          verified,
          last_profile_validation,
          video_faits_saillants_url,
          annee_diplomation,
          cote_globale_entraineur,
          school_id,
          coach_id,
          numero_jersey,
          status,
          statut_recrutement_override,
          recruitment_status, committed_school_id, open_to_offers,
          sport_id,
          position_id,
          mentions_academiques,
          moyenne_generale,
          created_at,
          sports!sport_id(nom),
          positions!position_id(nom, abreviation),
          schools!school_id(name, region),
          committed_school:schools!committed_school_id(name),
          team_athletes(team_id, teams!team_id(gender)),
          evaluations(cote_globale, rapport_entraineur, distinctions, updated_at)
        `)
        .eq("school_id", coachRow.school_id)
        .eq("status", "ACTIF");

      if (!data || cancelled) { if (!cancelled) setLoading(false); return; }

      // Favorites count — same source as web (L297-310)
      const ids = data.map((a: Record<string, unknown>) => a.id as string);
      const favCounts: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: favRows } = await supabase
          .from("recruiter_favorites")
          .select("athlete_id")
          .in("athlete_id", ids);
        if (favRows && Array.isArray(favRows)) {
          favRows.forEach((r: { athlete_id: string }) => {
            favCounts[r.athlete_id] = (favCounts[r.athlete_id] || 0) + 1;
          });
        }
      }

      const mapped: CoachAthlete[] = data.map((a: Record<string, unknown>) => mapCoachAthlete(a, favCounts));
      if (cancelled) return;
      setAthletes(mapped);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [refreshVersion]);

  /* ── Load positions when sport changes ── */
  useEffect(() => {
    if (!sport) { setDynamicPositions([]); setPosition(""); return; }
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data: sportRow } = await supabase
        .from("sports")
        .select("id")
        .ilike("nom", sport.replace(/_/g, " "))
        .single();
      if (!sportRow || cancelled) return;
      const { data: posRows } = await supabase
        .from("positions")
        .select("nom, abreviation")
        .eq("sport_id", sportRow.id)
        .order("nom");
      if (posRows && !cancelled) {
        setDynamicPositions(posRows.map((p: { nom: string; abreviation: string }) => ({
          abbr: p.abreviation,
          label: p.nom,
        })));
      }
    })();
    return () => { cancelled = true; };
  }, [sport]);

  /* ── Partition (Roster vs unclaimed) ── */
  const myRoster = useMemo(
    () => athletes.filter((a) => a.coachId === currentUserId),
    [athletes, currentUserId]
  );
  const unclaimedAthletes = useMemo(
    () => athletes.filter((a) => a.coachId == null),
    [athletes]
  );

  /* ── Filter pipeline (Roster tab) ── */
  const filtered = useMemo(() => {
    let list = [...myRoster];
    if (search.trim().length >= 2) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        a.firstName.toLowerCase().includes(q) ||
        a.lastName.toLowerCase().includes(q) ||
        `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
        a.position.toLowerCase().includes(q)
      );
    }
    if (sport) list = list.filter((a) => a.sport === sport);
    // Sans équipe → teamGender null → sort des résultats dès qu'un genre est choisi.
    if (genderFilter) list = list.filter((a) => a.teamGender === genderFilter);
    if (position) list = list.filter((a) => a.position === position);
    if (region) list = list.filter((a) => a.region === region);
    if (promotion) list = list.filter((a) => a.graduationYear === parseInt(promotion, 10));
    if (verifiedOnly) list = list.filter((a) => a.isVerified);
    if (withVideoOnly) list = list.filter((a) => a.hasVideo);
    if (minRating) list = list.filter((a) => a.stars >= parseFloat(minRating));
    if (withSportBadge) list = list.filter((a) => a.hasDistinction);
    if (withAcademicBadge) list = list.filter((a) => a.hasAcademicBadge);
    if (minGpa) list = list.filter((a) => (a.gpa || 0) >= parseFloat(minGpa));

    switch (sortBy) {
      case "rating_desc": list.sort((a, b) => b.stars - a.stars); break;
      case "rating_asc": list.sort((a, b) => a.stars - b.stars); break;
      case "favorites_desc": list.sort((a, b) => b.favoritesCount - a.favoritesCount); break;
      case "grad_asc": list.sort((a, b) => a.graduationYear - b.graduationYear); break;
      case "grad_desc": list.sort((a, b) => b.graduationYear - a.graduationYear); break;
      case "name_asc": list.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)); break;
    }

    return list;
  }, [myRoster, search, sport, genderFilter, position, region, promotion, verifiedOnly, withVideoOnly, minRating, withSportBadge, withAcademicBadge, minGpa, sortBy]);

  const activeFiltersCount = [
    sport, genderFilter, position, promotion, region, minGpa,
    verifiedOnly, withVideoOnly, minRating, withSportBadge, withAcademicBadge,
    sortBy !== "rating_desc",
  ].filter(Boolean).length;

  const resetFilters = useCallback(() => {
    setSport(""); setGenderFilter(""); setPosition(""); setPromotion(""); setRegion(""); setMinGpa("");
    setSortBy("rating_desc");
    setVerifiedOnly(false); setWithVideoOnly(false); setMinRating("");
    setWithSportBadge(false); setWithAcademicBadge(false);
  }, []);

  /* ── Picker option lists ── */
  const positionOptions: PickerOption[] = useMemo(() => {
    const opts: PickerOption[] = [{ value: "", label: "Toutes les positions" }];
    for (const p of dynamicPositions) {
      opts.push({ value: p.abbr || p.label, label: `${p.label}${p.abbr ? ` (${p.abbr})` : ""}` });
    }
    return opts;
  }, [dynamicPositions]);

  const regionOptions: PickerOption[] = useMemo(() => {
    const opts: PickerOption[] = [{ value: "", label: "Toutes les régions" }];
    const uniq = Array.from(new Set(athletes.map((a) => a.region).filter(Boolean))).sort();
    for (const r of uniq) opts.push({ value: r, label: r });
    return opts;
  }, [athletes]);

  /* ── Scroll listener (sticky search blur) ── */
  useEffect(() => {
    let raf = 0; let last = 0; let tick = false;
    const onScroll = () => {
      last = window.scrollY || 0;
      if (!tick) {
        raf = window.requestAnimationFrame(() => { setScrollY(last); tick = false; });
        tick = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) window.cancelAnimationFrame(raf); };
  }, []);
  const scrolled = scrollY > 20;

  /* ── Pull-to-refresh ── */
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const PULL_THRESHOLD = 80;
  useEffect(() => {
    let startY = 0; let current = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (showFilters || showConfirm) return;
      if ((window.scrollY || 0) === 0) startY = e.touches[0].clientY; else startY = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (showFilters || showConfirm) return;
      if ((window.scrollY || 0) !== 0 || startY === 0) return;
      current = Math.max(0, Math.min(e.touches[0].clientY - startY, 120));
      setPullDistance(current);
      setIsPulling(current > 0);
    };
    const onTouchEnd = async () => {
      if (showFilters || showConfirm) return;
      if (current >= PULL_THRESHOLD && !isRefreshing) {
        setIsRefreshing(true);
        triggerHaptic("Medium");
        setRefreshVersion((v) => v + 1);
        window.setTimeout(() => { setIsRefreshing(false); setPullDistance(0); setIsPulling(false); }, 600);
      } else {
        setPullDistance(0); setIsPulling(false);
      }
      startY = 0; current = 0;
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [showFilters, showConfirm, isRefreshing]);

  /* ── Claim handlers ── */
  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleClaim() {
    if (selectedIds.size === 0 || submitting) return;
    setSubmitting(true);
    const ids = Array.from(selectedIds);
    const supabase = createClient();
    const { error } = await supabase
      .from("athletes")
      .update({ coach_id: currentUserId })
      .in("id", ids);

    if (error) {
      console.error("[Claim failed]", error);
      toast.error({ message: "Impossible de réclamer ces athlètes." });
      setSubmitting(false);
      setShowConfirm(false);
      return;
    }

    toast.success({ message: `${ids.length} athlète${ids.length > 1 ? "s ajoutés" : " ajouté"} à ton roster.` });
    setSelectedIds(new Set());
    setShowConfirm(false);
    setSubmitting(false);
    setRefreshVersion((v) => v + 1);
  }

  /* ── Mount stagger flag ── */
  const hasStaggeredRef = useRef(false);
  useEffect(() => {
    const list = activeTab === "roster" ? filtered : unclaimedAthletes;
    if (!loading && list.length > 0 && !hasStaggeredRef.current) {
      hasStaggeredRef.current = true;
    }
  }, [loading, filtered.length, unclaimedAthletes.length, activeTab]);

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-[#111317] text-white nx-mobile-pb-tabbar">
      {/* Pull-to-refresh indicator */}
      {(isPulling || isRefreshing) && (
        <div
          className="fixed left-0 right-0 z-[55] flex justify-center items-center pointer-events-none"
          style={{ top: 0, height: Math.max(pullDistance, isRefreshing ? 60 : 0) }}
        >
          <div
            className="rounded-full p-2"
            style={{
              background: "rgba(230, 57, 70, 0.1)",
              transform: isRefreshing ? "rotate(0deg)" : `rotate(${pullDistance * 4}deg)`,
              opacity: Math.min(pullDistance / PULL_THRESHOLD, 1),
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: isRefreshing ? "nx-coach-rotate 1s linear infinite" : "none" }}>
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </div>
          <style jsx>{`@keyframes nx-coach-rotate { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Search bar */}
      <MobileSearchBar
        search={search}
        onSearchChange={setSearch}
        activeFiltersCount={activeFiltersCount}
        onOpenFilters={() => setShowFilters(true)}
        scrolled={scrolled}
        viewMode={viewMode}
        onToggleViewMode={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
        showViewToggle={activeTab === "roster"}
      />

      {/* Iter 2b — Tabs (gauche) + count (droite) sur la MÊME ROW.
          Le view-toggle a migré dans MobileSearchBar (bouton unique top). */}
      <div className="px-4 pt-2 pb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-[#13151a] rounded-xl p-1.5">
          <button
            type="button"
            onClick={() => { triggerHaptic("Light"); setActiveTab("roster"); setSelectedIds(new Set()); }}
            className={`px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-[0.12em] transition-all ${
              activeTab === "roster"
                ? "bg-[#E63946] text-white shadow-[0_0_10px_rgba(230,57,70,0.25)]"
                : "text-[#6b7280]"
            }`}
          >
            Roster
          </button>
          <button
            type="button"
            onClick={() => { triggerHaptic("Light"); setActiveTab("reclamer"); }}
            className={`px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-[0.12em] transition-all flex items-center gap-2 ${
              activeTab === "reclamer"
                ? "bg-[#E63946] text-white shadow-[0_0_10px_rgba(230,57,70,0.25)]"
                : "text-[#6b7280]"
            }`}
          >
            À réclamer
            {unclaimedAthletes.length > 0 && activeTab !== "reclamer" && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] text-[11px] font-bold">
                {unclaimedAthletes.length}
              </span>
            )}
          </button>
        </div>
        <span className="text-[12px] font-bold text-[#6B7280] whitespace-nowrap">
          {loading
            ? "Chargement…"
            : activeTab === "roster"
              ? `${filtered.length} athlète${filtered.length !== 1 ? "s" : ""}`
              : `${unclaimedAthletes.length} à réclamer`}
        </span>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {loading && athletes.length === 0 ? (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <SkeletonGrid />
          </motion.div>
        ) : activeTab === "roster" ? (
          filtered.length === 0 ? (
            <motion.div key="empty-roster" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-6 py-12 text-center">
              {myRoster.length === 0 && unclaimedAthletes.length > 0 ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mx-auto mb-4">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4V7" />
                      <circle cx="8.5" cy="7" r="4" />
                      <path d="M20 8v6" />
                      <path d="M23 11h-6" />
                    </svg>
                  </div>
                  <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight mb-2">Aucun athlète dans ton roster</h3>
                  <p className="text-[13px] text-[#9CA3AF] max-w-xs mx-auto leading-relaxed mb-4">
                    Réclame des athlètes parmi ceux disponibles à ton école pour bâtir ton roster.
                  </p>
                  <button
                    type="button"
                    onClick={() => { triggerHaptic("Light"); setActiveTab("reclamer"); }}
                    className="inline-flex items-center gap-2 bg-[#E63946] text-white rounded-2xl px-5 py-3 font-head font-bold text-[12px] uppercase tracking-widest active:bg-[#D42B22]"
                  >
                    Voir les athlètes à réclamer ({unclaimedAthletes.length})
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mx-auto mb-4">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                    </svg>
                  </div>
                  <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight mb-2">Aucun athlète trouvé</h3>
                  <p className="text-[13px] text-[#9CA3AF] max-w-xs mx-auto leading-relaxed">
                    Essaie d&apos;élargir tes critères ou de réinitialiser les filtres.
                  </p>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={`roster-${viewMode}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              {viewMode === "grid" ? (
                <div className="grid grid-cols-2 gap-3 p-4">
                  <AnimatePresence mode="popLayout">
                    {filtered.map((a, idx) => (
                      <motion.div
                        key={a.id}
                        layout
                        initial={hasStaggeredRef.current ? { opacity: 0, y: 4 } : { opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{
                          duration: hasStaggeredRef.current ? 0.18 : 0.35,
                          delay: hasStaggeredRef.current ? 0 : Math.min(idx * 0.06, 0.6),
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      >
                        <AthleteCardMobile
                          a={cardData(a)}
                          isFree={false}
                          favDisabled
                          onToggleFav={() => { /* no-op coach roster */ }}
                          favoritesCount={a.favoritesCount}
                          profileHref={`/coach/athletes/${a.id}`}
                          layoutIdPrefix="coach-athlete-photo"
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="space-y-2 p-4">
                  <AnimatePresence mode="popLayout">
                    {filtered.map((a, idx) => (
                      <motion.div
                        key={a.id}
                        layout
                        initial={hasStaggeredRef.current ? { opacity: 0, y: 4 } : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{
                          duration: hasStaggeredRef.current ? 0.18 : 0.3,
                          delay: hasStaggeredRef.current ? 0 : Math.min(idx * 0.04, 0.4),
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      >
                        <CoachAthleteRowMobile
                          a={a}
                          onTap={() => router.push(`/coach/athletes/${a.id}`)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )
        ) : (
          /* ══════════ À RÉCLAMER ══════════ */
          unclaimedAthletes.length === 0 ? (
            <motion.div key="empty-claim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-6 py-12 text-center">
              <img
                src="/empty/nexus-empty-effectif.png"
                alt="Aucun athlète à réclamer"
                className="mx-auto mb-4 w-[140px] h-auto object-contain"
                /* optical offset for left-weighted PNG — remove if asset re-exported balanced */
                style={{ transform: "translateX(14px)" }}
              />
              <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">Aucun athlète non réclamé</h3>
              <p className="text-[13px] text-[#9CA3AF] mt-2 max-w-sm mx-auto">
                Aucun athlète non réclamé à ton école pour l&apos;instant.
              </p>
            </motion.div>
          ) : (
            <motion.div key="claim-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-2 gap-3 p-4 pb-32">
                <AnimatePresence mode="popLayout">
                  {unclaimedAthletes.map((a, idx) => (
                    <motion.div
                      key={a.id}
                      layout
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        duration: 0.35,
                        delay: Math.min(idx * 0.06, 0.6),
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <AthleteCardMobile
                        a={cardData(a)}
                        isFree={false}
                        favDisabled
                        onToggleFav={() => { /* no-op claim */ }}
                        selected={selectedIds.has(a.id)}
                        onToggleSelect={toggleSelected}
                        layoutIdPrefix="coach-claim-photo"
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>

      {/* Sticky claim action bar */}
      <AnimatePresence>
        {activeTab === "reclamer" && selectedIds.size > 0 && (
          <motion.div
            key="claim-action"
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed left-4 right-4 z-40 bg-[#1A1D24] border border-[#E63946]/30 rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3"
            style={{ bottom: "calc(80px + env(safe-area-inset-bottom))" }}
          >
            <span className="flex-1 text-[13px] text-white">
              <span className="font-bold">{selectedIds.size}</span> sélectionné{selectedIds.size > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={() => { triggerHaptic("Light"); setSelectedIds(new Set()); }}
              className="text-[12px] font-bold text-[#9CA3AF] active:text-white"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => { triggerHaptic("Medium"); setShowConfirm(true); }}
              className="px-4 py-2 bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-wider rounded-xl active:bg-[#D42B22]"
            >
              Réclamer {selectedIds.size}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters sheet */}
      <FiltersBottomSheet
        open={showFilters}
        onClose={() => setShowFilters(false)}
        onReset={resetFilters}
        resultCount={filtered.length}
        sport={sport} setSport={setSport}
        genderFilter={genderFilter} setGenderFilter={setGenderFilter}
        position={position} setPosition={setPosition}
        promotion={promotion} setPromotion={setPromotion}
        region={region} setRegion={setRegion}
        minGpa={minGpa} setMinGpa={setMinGpa}
        sortBy={sortBy} setSortBy={setSortBy}
        verifiedOnly={verifiedOnly} setVerifiedOnly={setVerifiedOnly}
        withVideoOnly={withVideoOnly} setWithVideoOnly={setWithVideoOnly}
        withSportBadge={withSportBadge} setWithSportBadge={setWithSportBadge}
        withAcademicBadge={withAcademicBadge} setWithAcademicBadge={setWithAcademicBadge}
        minRating={minRating} setMinRating={setMinRating}
        positionOptions={positionOptions}
        regionOptions={regionOptions}
      />

      {/* Confirm claim sheet */}
      <ConfirmClaimSheet
        open={showConfirm}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleClaim}
        count={selectedIds.size}
        submitting={submitting}
      />

      {/* Floating "+" FAB — opens the create wizard at /coach/athletes/create.
          Visible on BOTH toggle tabs (Roster + À réclamer). Hidden only while
          the claim selection bar is up.
          ⚠️ Porté dans document.body via createPortal : sinon `position:fixed`
          est piégé par le `transform` de AnimatedRoute (containing block) →
          le FAB s'ancrait sur la hauteur de contenu et chevauchait les cartes.
          z-50 = AU-DESSUS de la bubble (z-40). bottom calé au-dessus de la
          bubble flottante (~64px + offset 10 → 88px) + 16px de gap. */}
      {!(activeTab === "reclamer" && selectedIds.size > 0) && mounted && typeof document !== "undefined" && createPortal(
        <button
          type="button"
          aria-label="Ajouter ou inviter un athlète"
          onClick={() => { triggerHaptic("Medium"); setFabMenuOpen(true); }}
          className="fixed right-4 z-50 w-14 h-14 rounded-full bg-[#E63946] text-white flex items-center justify-center shadow-[0_4px_16px_rgba(230,57,70,0.4)] active:scale-95 active:bg-[#D42B22] transition-transform"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 88px + 16px)" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </button>,
        document.body,
      )}

      <FabActionSheet
        open={fabMenuOpen}
        onClose={() => setFabMenuOpen(false)}
        onAdd={() => { setFabMenuOpen(false); router.push("/coach/athletes/create"); }}
        onInvite={() => { setFabMenuOpen(false); setInviteOpen(true); }}
      />
      <InviteByEmailSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={(message) => { setInviteOpen(false); toast.success({ message }); }}
      />
    </div>
  );
}
