"use client";

/* ═══════════════════════════════════════════════════════════════
   RecruteurRechercheMobile — Page Recherche mobile-native
   Iter 6.0a : MVP utilisable (sticky search + grid 4:5 + FiltersSheet
   + 1 picker proof of concept Sport).
   Iter 6.0b : Polish premium iOS — cards V2 épurées + double-tap +
   AthleteRowMobile + ViewToggle interactif + SuggestionsPanel
   (récents/trending/autocomplete) + 7 MobilePicker + mount stagger
   Airbnb + search bar morph fullscreen + shared element layoutId
   prêt pour la transition card → profil.

   Référence design : docs/mobile-design-system.md.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import AthletePhoto from "@/components/shared/AthletePhoto";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";
import type { GlobalRecruitmentStatus } from "@/lib/types/models";
import { EmptyState as SharedEmptyState } from "@/components/mobile/EmptyState";
import { isValidationExpired } from "@/lib/utils/profileValidation";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useFavorites } from "@/lib/queries/shared/useFavorites";
import { useFavoriteCounts } from "@/lib/queries/shared/useFavoriteCounts";
import { useRegions } from "@/lib/queries/shared/useRegions";
import { useAthleteSearch } from "@/lib/queries/recruiter/useAthleteSearch";
import { LOCKED_NAME_LABEL } from "@/lib/queries/shared/recruiterAthleteCards";
import { usePositionsBySport } from "@/lib/queries/recruiter/usePositionsBySport";
import { useRecentViewedAthletes } from "@/lib/queries/recruiter/useRecentViewedAthletes";
import { useAthleteAutocomplete } from "@/lib/queries/recruiter/useAthleteAutocomplete";
import { useTrendingAthletes } from "@/lib/queries/recruiter/useTrendingAthletes";
import { useDebouncedValue } from "@/lib/utils/useDebouncedValue";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { HeartButton } from "@/components/mobile/HeartButton";
import { MobilePicker, type PickerOption } from "@/components/mobile/MobilePicker";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { createClient } from "@/lib/supabase/client";

import { TEAM_GENDER_FILTER_OPTIONS } from "@/lib/config/gender";
import { triggerHaptic } from "@/lib/haptics";
import ProgrammeCegepPicker from "@/components/shared/ProgrammeCegepPicker";
import { useCegepPrograms, useMonCegepOffreDesProgrammes } from "@/lib/queries/shared/useCegepPrograms";
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

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "rating_desc", label: "Meilleure cote" },
  { value: "rating_asc", label: "Cote croissante" },
  { value: "favorites_desc", label: "Plus favorisés" },
  { value: "plus_vus", label: "Plus vus" },
  { value: "name_asc", label: "Nom A-Z" },
];

const PROMOTION_OPTIONS: PickerOption[] = [
  { value: "", label: "Toutes les promotions" },
  { value: "2026", label: "Promotion 2026" },
  { value: "2027", label: "Promotion 2027" },
  { value: "2028", label: "Promotion 2028" },
];

const ORG_OPTIONS: PickerOption[] = [
  { value: "", label: "Toutes" },
  { value: "scolaire", label: "Scolaire (RSEQ)" },
  { value: "ligue_civile", label: "Ligue civile" },
];

const GPA_OPTIONS: PickerOption[] = [
  { value: "", label: "Aucun minimum" },
  { value: "60", label: "60 %+" },
  { value: "65", label: "65 %+" },
  { value: "70", label: "70 %+" },
  { value: "75", label: "75 %+" },
  { value: "80", label: "80 %+" },
  { value: "85", label: "85 %+" },
  { value: "90", label: "90 %+" },
];

/* Mapping recruitment_status global (PAS pipeline stage) → pill épuré.
   Iter 6.0c — palette sémantique corrigée :
     OUVERT       → vert (disponible)
     EN_PROCESSUS → ambre pulse (caution + activité)
     RECRUTE      → rouge (final, signé)
     RETIRE       → gris
   À distinguer du PIPELINE_DOT_MAP du profil athlète mobile qui
   couvre les stages du pipeline RECRUTEUR (IDENTIFIE → LETTRE_SIGNEE). */
type StatusPill = { label: string; dot: string; text: string; animated: boolean } | null;
function statusPillFromStatus(status: string): StatusPill {
  switch (status) {
    case "OUVERT":
      return { label: "OUVERT", dot: "bg-[#22C55E]", text: "#22C55E", animated: false };
    case "EN_PROCESSUS":
    case "VISITE_PLANIFIEE":
    case "EN_DISCUSSION":
    case "CONTACTE":
      return { label: "EN PROCESSUS", dot: "bg-[#F59E0B]", text: "#F59E0B", animated: true };
    case "RECRUTE":
    case "ENGAGE":
    case "LETTRE_SIGNEE":
      return { label: "RECRUTÉ", dot: "bg-[#E63946]", text: "#E63946", animated: false };
    case "RETIRE":
      return { label: "RETIRÉ", dot: "bg-gray-500", text: "#6B7280", animated: false };
    case "IDENTIFIE":
    case "":
    default:
      return null;
  }
}


/* ── MobileSearchBar (pill + morph fullscreen) ────────────── */

interface MobileSearchBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  activeFiltersCount: number;
  onOpenFilters: () => void;
  scrolled: boolean;
  disabled?: boolean;
  placeholder: string;
  onExpand: () => void;
  /** Iter 2b — single view-toggle button (replaces le segmented). Icône =
   *  mode vers lequel on bascule (iOS canon : list icon en grid, grid icon
   *  en list). Optionnel pour backward-compat. */
  viewMode?: "grid" | "list";
  onToggleViewMode?: () => void;
  showViewToggle?: boolean;
}

function MobileSearchBar({
  search, activeFiltersCount, onOpenFilters, scrolled, disabled, placeholder, onExpand,
  viewMode, onToggleViewMode, showViewToggle,
}: MobileSearchBarProps) {
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
        <button
          type="button"
          onClick={() => { if (!disabled) { triggerHaptic("Light"); onExpand(); } }}
          disabled={disabled}
          className={`flex-1 rounded-2xl bg-[#1A1D24] px-4 h-11 flex items-center gap-3 ${disabled ? "opacity-50" : "active:bg-white/[0.04]"}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <span className={`text-[16px] truncate text-left flex-1 ${search ? "text-white" : "text-[#6B7280]"}`}>
            {search || placeholder}
          </span>
        </button>
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

/* ── SuggestionItem ───────────────────────────────────────── */

interface SuggestionItemProps {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  subtitle: string;
  query?: string;
  onTap: () => void;
  /** false = identité masquée (Loi 25 ou tier FREE). */
  identityVisible?: boolean;
  /** Libellé déjà résolu à afficher quand identityVisible est false. */
  lockedLabel?: string;
}

function SuggestionItem({ id, firstName, lastName, photoUrl, subtitle, query, onTap, identityVisible, lockedLabel }: SuggestionItemProps) {
  // Highlight match si query
  const renderName = () => {
    // Sous masquage, pas de surlignage : il n'y a pas de nom à
    // surligner, et la requête ne doit pas laisser croire qu'elle a
    // matché quelque chose.
    if (identityVisible === false) return lockedLabel ?? "Identité réservée";
    const name = `${firstName} ${lastName}`.trim() || "—";
    if (!query || query.length < 2) return name;
    const lower = name.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx === -1) return name;
    return (
      <>
        {name.slice(0, idx)}
        <span className="text-[#E63946] font-bold">{name.slice(idx, idx + query.length)}</span>
        {name.slice(idx + query.length)}
      </>
    );
  };
  return (
    <Link
      href={`/recruteur/athletes/${id}`}
      onClick={onTap}
      className="flex items-center gap-3 p-2 rounded-2xl active:bg-[#1A1D24] transition-colors"
    >
      <div className="relative w-11 h-11 rounded-full overflow-hidden flex-shrink-0 bg-[#2F3440]">
        <AthletePhoto photoUrl={photoUrl ?? ""} firstName={firstName} lastName={lastName} size={44} identityVisible={identityVisible} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-[15px] truncate">{renderName()}</p>
        <p className="text-[13px] text-[#9CA3AF] truncate">{subtitle}</p>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2.5" strokeLinecap="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  );
}

/* ── SuggestionsPanel ─────────────────────────────────────── */

function SuggestionsPanel({ query, onItemTap }: { query: string; onItemTap: () => void }) {
  const { data: recent = [] } = useRecentViewedAthletes(3);
  const { data: trending = [] } = useTrendingAthletes();
  const { data: autocomplete = [], isLoading: acLoading } = useAthleteAutocomplete(query);
  const showAutocomplete = query.trim().length >= 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="px-4 pb-6"
    >
      {showAutocomplete ? (
        <section>
          <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B7280] mb-2 px-2">
            Résultats pour &laquo; {query} &raquo;
          </h3>
          {acLoading && autocomplete.length === 0 ? (
            <p className="text-[12px] text-[#6B7280] px-2 py-4">Recherche…</p>
          ) : autocomplete.length === 0 ? (
            <p className="text-[12px] text-[#6B7280] px-2 py-4">Aucun résultat.</p>
          ) : (
            <div className="space-y-1">
              {autocomplete.map((a) => (
                <SuggestionItem
                  key={a.id}
                  id={a.id}
                  firstName={a.firstName}
                  lastName={a.lastName}
                  photoUrl={a.photoUrl}
                  subtitle={[a.position, a.sport, a.school].filter(Boolean).join(" · ") || "—"}
                  query={query}
                  onTap={onItemTap}
                  identityVisible={a.identityVisible}
                  lockedLabel={a.fullName}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {recent.length > 0 && (
            <section className="mb-5">
              <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B7280] mb-2 px-2">
                Récemment consultés
              </h3>
              <div className="space-y-1">
                {recent.map((a) => (
                  <SuggestionItem
                    key={a.id}
                    id={a.id}
                    firstName={a.firstName}
                    lastName={a.lastName}
                    photoUrl={a.photoUrl}
                    subtitle={[a.position, a.sport, a.school].filter(Boolean).join(" · ") || "—"}
                    onTap={onItemTap}
                    identityVisible={a.identityVisible}
                    lockedLabel={a.fullName}
                  />
                ))}
              </div>
            </section>
          )}
          {trending.length > 0 && (
            <section>
              <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B7280] mb-2 px-2">
                Tendances cette semaine
              </h3>
              <div className="space-y-1">
                {trending.slice(0, 5).map((t) => {
                  const [firstName, ...lastParts] = (t.name || "").split(" ");
                  const lastName = lastParts.join(" ");
                  return (
                    <SuggestionItem
                      key={t.id}
                      id={t.id}
                      firstName={firstName ?? ""}
                      lastName={lastName}
                      photoUrl={null}
                      subtitle={[t.position, t.school].filter(Boolean).join(" · ") || "—"}
                      onTap={onItemTap}
                      identityVisible={t.identityVisible}
                      lockedLabel={t.name}
                    />
                  );
                })}
              </div>
            </section>
          )}
          {recent.length === 0 && trending.length === 0 && (
            <p className="text-[12px] text-[#6B7280] px-2 py-8 text-center">
              Commence à taper pour rechercher un athlète…
            </p>
          )}
        </>
      )}
    </motion.div>
  );
}

/* ── ExpandedSearchOverlay ────────────────────────────────── */

function ExpandedSearchOverlay({
  search, onSearchChange, onClose, isFreeRecruiter,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  onClose: () => void;
  isFreeRecruiter: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[60] bg-[#111317] overflow-y-auto"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
        className="px-4 pt-3 pb-2"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { triggerHaptic("Light"); onClose(); }}
            aria-label="Fermer"
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/5"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div className="flex-1 rounded-2xl bg-[#1A1D24] px-4 h-11 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              autoFocus
              type="text"
              inputMode="search"
              placeholder={isFreeRecruiter ? "Recherche par nom (Pro)" : "Rechercher un athlète…"}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              disabled={isFreeRecruiter}
              className="flex-1 bg-transparent text-[16px] text-white placeholder:text-[#6B7280] outline-none"
            />
            {search.length > 0 && (
              <button type="button" onClick={() => { void triggerHaptic("Light"); onSearchChange(""); }} className="text-[#6B7280] active:text-white" aria-label="Effacer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </motion.div>
      <SuggestionsPanel query={search} onItemTap={onClose} />
    </motion.div>,
    document.body,
  );
}

/* ── AthleteCardMobile V2 (épurée + double-tap + status dot) ─
   Iter 7.9 Section 8 — exporté pour réutilisation dans Favoris mobile
   (même carte visuelle, source de données différente). */

export interface AthleteCardProps {
  a: {
    id: string;
    firstName: string;
    lastName: string;
    photo: string;
    position: string;
    sportName: string;
    school: string;
    graduationYear: number;
    stars: number;
    isVerified: boolean;
    lastValidation?: string | null;
    isFavorited: boolean;
    jersey: string;
    recruitmentStatus: string;
    committedSchoolName: string | null;
    openToOffers: boolean | null;
    noTeam: boolean;
    /**
     * Décision SERVEUR (identity_visible des RPC recruteur). false = nom,
     * photo et dossard sont ABSENTS de la réponse, pas juste cachés.
     *
     * `undefined` = la surface appelante n'est pas encore branchée sur une
     * RPC projetée (cas de Favoris mobile, qui passe encore par
     * useAthletesByIds). Elle retombe alors sur `isFree` ci-dessous.
     */
    identityVisible?: boolean;
  };
  /**
   * ⚠️ REPLI HISTORIQUE, VOUÉ À DISPARAÎTRE.
   *
   * Ne sert QUE lorsque `a.identityVisible` est undefined, c'est-à-dire pour
   * les surfaces pas encore basculées sur les RPC (Favoris mobile). Sur ces
   * surfaces, la donnée arrive en clair de `athletes` et le seul masquage
   * possible est celui-ci, côté client.
   *
   * Il ne couvre PAS la Loi 25 — un client ne peut pas savoir si l'athlète
   * est un mineur sans consentement parental, la date de naissance ne lui
   * étant jamais projetée. Il ne couvre que le tier. C'est précisément
   * pourquoi il doit mourir avec la bascule de useAthletesByIds, et pourquoi
   * la Recherche (déjà basculée) ne le passe plus.
   */
  isFree?: boolean;
  favDisabled: boolean;
  onToggleFav: (id: string) => void;
  /** Iter 7.10 Section 3 — clé sessionStorage 'lastRecruiterTab' posée
   *  avant push vers le profil pour que le back-nav du profil revienne
   *  à l'onglet d'origine (Recherche / Favoris / Pipeline). Default "recherche". */
  lastTabKey?: string;
  /** Coach roster mode — display-only count de recruteurs ayant favorisé
   *  cet athlète. Quand défini, remplace le HeartButton du top-left par
   *  un badge compteur (no toggle). Le coach ne favorise pas son roster. */
  favoritesCount?: number;
  /** Claim mode — quand onToggleSelect est défini, la carte entière
   *  agit comme un toggle de sélection (no nav, no double-tap-to-like).
   *  Rend une checkbox dans le top-left à la place du heart/count. */
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  /** Override de la destination de navigation. Défaut = /recruteur/athletes/{id}. */
  profileHref?: string;
  /** Préfixe pour motion layoutId — évite la collision shared-element
   *  si le recruteur ET le coach montent la même carte pendant une
   *  transition. Défaut "athlete-photo". Use "coach-athlete-photo" côté coach. */
  layoutIdPrefix?: string;
}

export function AthleteCardMobile({
  a, isFree, favDisabled, onToggleFav, lastTabKey = "recherche",
  favoritesCount, selected, onToggleSelect, profileHref, layoutIdPrefix,
}: AthleteCardProps) {
  const router = useRouter();
  // La décision serveur prime ; `isFree` n'est consulté que si elle est
  // absente. Voir les deux blocs de doc sur AthleteCardProps.
  const identityLocked = a.identityVisible === false || (a.identityVisible === undefined && !!isFree);
  const verifiedActive = a.isVerified && !isValidationExpired({ verified: !!a.isVerified, last_profile_validation: a.lastValidation ?? null });
  // Iter 7.3 Section B — status pill retiré du grid card
  const [showHeartPop, setShowHeartPop] = useState(false);
  const lastTapRef = useRef(0);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); }, []);

  const isClaimMode = !!onToggleSelect;
  const isCoachRosterMode = !isClaimMode && favoritesCount !== undefined;

  // Iter 6.0d — désambiguïsation tap simple vs double-tap, double-tap TOGGLE
  // complet (like ↔ unlike, pas Instagram strict). Tap 1 : nav programmée à
  // +300ms (annulable). Tap 2 dans la fenêtre : cancel nav + toggle fav +
  // pop coeur géant comme feedback (visible aussi sur unlike).
  // Coach modes (claim / roster) court-circuitent ce flow — pas de
  // double-tap-to-like (le coach ne favorise pas son propre roster).
  const handlePhotoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Claim mode — carte entière = toggle de sélection
    if (isClaimMode) {
      triggerHaptic("Light");
      onToggleSelect!(a.id);
      return;
    }
    // Coach roster mode — tap direct → nav (pas de double-tap-to-like)
    if (isCoachRosterMode) {
      triggerHaptic("Light");
      router.push(profileHref ?? `/recruteur/athletes/${a.id}`);
      return;
    }
    // Recruteur — comportement original (nav + double-tap toggle)
    const now = Date.now();
    const since = now - lastTapRef.current;
    if (since < 300 && since > 0) {
      // Double-tap : cancel nav + toggle (like ou unlike)
      if (navTimerRef.current) { clearTimeout(navTimerRef.current); navTimerRef.current = null; }
      if (!favDisabled || a.isFavorited) onToggleFav(a.id);
      setShowHeartPop(true);
      triggerHaptic("Medium");
      window.setTimeout(() => setShowHeartPop(false), 600);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
    navTimerRef.current = setTimeout(() => {
      try { sessionStorage.setItem("lastRecruiterTab", lastTabKey); } catch { /* no-op */ }
      router.push(profileHref ?? `/recruteur/athletes/${a.id}`);
      navTimerRef.current = null;
    }, 300);
  };

  const handleHeartTap = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Annule toute navigation programmée
    if (navTimerRef.current) { clearTimeout(navTimerRef.current); navTimerRef.current = null; }
    lastTapRef.current = 0;
    onToggleFav(a.id);
  };

  return (
    <div onClick={handlePhotoClick} role="link" tabIndex={0} className="block cursor-pointer">
      <motion.div
        layoutId={`${layoutIdPrefix ?? "athlete-photo"}-${a.id}`}
        className={`relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#1A1D24] ${
          selected ? "ring-2 ring-[#E63946] shadow-[0_0_20px_rgba(230,57,70,0.3)]" : ""
        }`}
      >
        {/* identityLocked → LockedIdentityPlaceholder (asset Cody + cadenas),
            jamais un flou : la photo ne doit pas atteindre le navigateur. */}
        <AthletePhotoFill
          photoUrl={a.photo}
          firstName={a.firstName}
          lastName={a.lastName}
          identityVisible={!identityLocked}
          initialsFontSize={64}
          className="object-[center_15%]"
        />
        {/* Iter 7.5 Section B — gradient termine en #1A1D24 OPAQUE (couleur
            carte) pour fusion propre avec les coins rounded du parent. */}
        <div
          className="absolute inset-x-0 bottom-0 h-2/3 z-[2] pointer-events-none"
          style={{ background: "linear-gradient(to top, #1A1D24 0%, rgba(26,29,36,0.85) 35%, transparent 70%)" }}
        />
        {/* Iter 7.5 Section E — top-left ÉPURÉ : heart SEUL (action favori).
            Le verified check passe inline près de la position (bottom overlay).
            Container 32x32 pour matcher la taille native du HeartButton sm.
            Coach claim mode → checkbox · Coach roster mode → favorites count badge. */}
        <div className="absolute top-2 left-2 z-10">
          {isClaimMode ? (
            <div className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
              selected
                ? "bg-[#E63946] border-2 border-[#E63946]"
                : "bg-[#111317]/80 border-2 border-[#4a4d56]"
            }`}>
              {selected && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </div>
          ) : isCoachRosterMode ? (
            (favoritesCount ?? 0) > 0 ? (
              <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#E63946" stroke="none">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                </svg>
                <span className="text-[12px] font-bold text-white leading-none">{favoritesCount}</span>
              </div>
            ) : null
          ) : (
            <div
              onClick={handleHeartTap}
              className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
            >
              <HeartButton
                isFavorited={a.isFavorited}
                onToggle={() => onToggleFav(a.id)}
                size="sm"
                disabled={favDisabled}
              />
            </div>
          )}
        </div>
        {/* Top-right : stars pill (Iter 7.4 Section B — 14px lisible) */}
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 z-10">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span className="text-[14px] font-bold text-white leading-none">{a.stars.toFixed(1)}</span>
        </div>
        {/* Double-tap heart pop (Instagram-style) */}
        <AnimatePresence>
          {showHeartPop && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.15, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
            >
              <svg width="80" height="80" viewBox="0 0 24 24" fill="#E63946" stroke="none" style={{ filter: "drop-shadow(0 0 20px rgba(230,57,70,0.5))" }}>
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Bottom info overlay (Iter 7.5 Section B — respiration pb-4) */}
        <div className="absolute inset-x-0 bottom-0 px-3 pt-3 pb-4 z-10">
          <p className="text-white font-bold text-base truncate leading-tight">
            {identityLocked ? (
              <span className="inline-flex items-center gap-1.5 text-[#9CA3AF]">
                {LOCKED_NAME_LABEL}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </span>
            ) : (
              <>{a.firstName} {a.lastName}</>
            )}
          </p>
          {/* Iter 7.5 Section E — position + verified check inline (déplacé
              depuis le top-left). Pattern Twitter : badge collé à l'identité. */}
          <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
            <p className="text-[15px] text-[#9CA3AF] truncate">
              {a.position || a.sportName || "—"}
            </p>
            {verifiedActive && (
              <span className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#3B82F6]">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </div>
        </div>
      </motion.div>
      <style jsx>{`
        @keyframes nx-breathe {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}

/* ── AthleteRowMobile (NHL-style list view) ───────────────── */

function AthleteRowMobile({ a, isFree, favDisabled, onToggleFav }: AthleteCardProps) {
  const verifiedActive = a.isVerified && !isValidationExpired({ verified: !!a.isVerified, last_profile_validation: a.lastValidation ?? null });
  const pill = statusPillFromStatus(a.recruitmentStatus);
  const identityLocked = a.identityVisible === false || (a.identityVisible === undefined && !!isFree);
  return (
    <Link href={`/recruteur/athletes/${a.id}`} className="block">
      <div className="flex items-center gap-3 p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors">
        {/* Avatar carré 64x64 avec layoutId pour transition */}
        <motion.div
          layoutId={`athlete-photo-${a.id}`}
          className="relative w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-[#2F3440]"
        >
          <AthletePhoto photoUrl={a.photo} firstName={a.firstName} lastName={a.lastName} identityVisible={!identityLocked} size={64} />
          {verifiedActive && (
            <div className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#3B82F6]/20 backdrop-blur-sm flex items-center justify-center border border-[#111317]">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          )}
        </motion.div>
        {/* Info 3 lignes */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-[14px] truncate leading-tight">
            {identityLocked ? (
              <span className="inline-flex items-center gap-1.5 text-[#9CA3AF]">
                {LOCKED_NAME_LABEL}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </span>
            ) : (
              <>{a.firstName} {a.lastName}</>
            )}
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
            {pill && (
              <>
                <span className="text-[#4a4d56]">·</span>
                <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: pill.text }}>
                  {pill.label}
                </span>
              </>
            )}
            <span className="text-[#4a4d56]">·</span>
            <span className="text-[10px] uppercase text-[#6B7280]">{a.graduationYear}</span>
          </div>
        </div>
        {/* Heart button right */}
        <div onClick={(e) => { void triggerHaptic("Light"); e.preventDefault(); e.stopPropagation(); }}>
          <HeartButton isFavorited={a.isFavorited} onToggle={() => onToggleFav(a.id)} size="sm" disabled={favDisabled} />
        </div>
      </div>
    </Link>
  );
}

/* ── FilterRow (Iter 6.0d — compact iOS Settings style, palette ajustée) ─ */

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

/* ── TogglePill ────────────────────────────────────────────── */

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

/* ── FiltersBottomSheet (7 MobilePicker) ──────────────────── */

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
  orgType: string; setOrgType: (v: string) => void;
  minGpa: string; setMinGpa: (v: string) => void;
  sortBy: string; setSortBy: (v: string) => void;
  verifiedOnly: boolean; setVerifiedOnly: (v: boolean) => void;
  withVideoOnly: boolean; setWithVideoOnly: (v: boolean) => void;
  withSportBadge: boolean; setWithSportBadge: (v: boolean) => void;
  withAcademicBadge: boolean; setWithAcademicBadge: (v: boolean) => void;
  hideFavorites: boolean; setHideFavorites: (v: boolean) => void;
  filterOuvertDemenager: boolean; setFilterOuvertDemenager: (v: boolean) => void;
  filterOuvertPrive: boolean; setFilterOuvertPrive: (v: boolean) => void;
  progFilterIds: string[]; setProgFilterOpen: (v: boolean) => void;
  monCegepAUnCatalogue: boolean;
  offertParMonCegep: boolean; setOffertParMonCegep: (v: boolean) => void;
  filterOuvertAnglophone: boolean; setFilterOuvertAnglophone: (v: boolean) => void;
  minRating: string; setMinRating: (v: string) => void;
  positionOptions: PickerOption[];
  regionOptions: PickerOption[];
}

function FiltersBottomSheet(props: FiltersBottomSheetProps) {
  const { open, onClose, onReset, resultCount } = props;
  const [mounted, setMounted] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // 8 MobilePicker states (7 + genre d'équipe)
  const [openSport, setOpenSport] = useState(false);
  const [openGender, setOpenGender] = useState(false);
  const [openPosition, setOpenPosition] = useState(false);
  const [openPromotion, setOpenPromotion] = useState(false);
  const [openRegion, setOpenRegion] = useState(false);
  const [openOrg, setOpenOrg] = useState(false);
  const [openGpa, setOpenGpa] = useState(false);
  const [openSort, setOpenSort] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open) { setDragOffset(0); setIsDragging(false); }
  }, [open]);

  if (!mounted || !open) return null;
  let handleStartY = 0;
  const closeSheet = () => { triggerHaptic("Light"); onClose(); };

  const sportLabel = SPORTS.find((s) => s.value === props.sport)?.label || "Tous les sports";
  const genderLabelValue = TEAM_GENDER_FILTER_OPTIONS.find((g) => g.value === props.genderFilter)?.label || "Tous";
  const positionLabel = props.positionOptions.find((p) => p.value === props.position)?.label || "Toutes les positions";
  const promotionLabel = PROMOTION_OPTIONS.find((p) => p.value === props.promotion)?.label || "Toutes les promotions";
  const regionLabel = props.regionOptions.find((r) => r.value === props.region)?.label || "Toutes les régions";
  const orgLabel = ORG_OPTIONS.find((o) => o.value === props.orgType)?.label || "Toutes";
  const gpaLabel = GPA_OPTIONS.find((g) => g.value === props.minGpa)?.label || "Aucun minimum";
  const sortLabel = SORT_OPTIONS.find((s) => s.value === props.sortBy)?.label || "Meilleure cote";

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[60]"
        style={{
          background: `rgba(0,0,0,${Math.max(0.2, 0.6 - dragOffset / 300)})`,
          animation: isDragging ? undefined : "nx-modal-fade 200ms ease-out forwards",
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
          animation: isDragging || dragOffset > 0 ? undefined : "nx-modal-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
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
          {/* Iter 6.0d — 7 rows compacts dans UN container card style iOS Settings.
              Bg #1A1D24 (canon Nexus, cohérent avec les autres cards). */}
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
            <FilterRow label="Organisation" value={orgLabel} onTap={() => setOpenOrg(true)} />
            <FilterRow label="GPA minimum" value={gpaLabel} onTap={() => setOpenGpa(true)} />
            <FilterRow label="Trier par" value={sortLabel} onTap={() => setOpenSort(true)} />
          </div>

          {/* Critères rapides */}
          <section className="px-4">
            <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B7280] mb-3">Critères rapides</h3>
            <div className="flex flex-wrap gap-2">
              <TogglePill active={props.verifiedOnly} label="Vérifié" onTap={() => props.setVerifiedOnly(!props.verifiedOnly)} />
              <TogglePill active={props.withVideoOnly} label="Avec vidéo" onTap={() => props.setWithVideoOnly(!props.withVideoOnly)} />
              <TogglePill active={props.minRating === "4"} label="4+ étoiles" onTap={() => props.setMinRating(props.minRating === "4" ? "" : "4")} />
              <TogglePill active={props.withSportBadge} label="Distinction" onTap={() => props.setWithSportBadge(!props.withSportBadge)} />
              <TogglePill active={props.withAcademicBadge} label="Mention académique" onTap={() => props.setWithAcademicBadge(!props.withAcademicBadge)} />
              <TogglePill active={props.hideFavorites} label="Masquer favoris" onTap={() => props.setHideFavorites(!props.hideFavorites)} />
            </div>
          </section>

          {/* Ouvertures */}
          <section className="px-4">
            <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B7280] mb-3">Ouvertures</h3>
            <div className="flex flex-wrap gap-2">
              <TogglePill active={props.filterOuvertDemenager} label="Déménager" onTap={() => props.setFilterOuvertDemenager(!props.filterOuvertDemenager)} />
              <TogglePill active={props.progFilterIds.length > 0}
                label={props.progFilterIds.length > 0 ? `Programme (${props.progFilterIds.length})` : "Programme"}
                onTap={() => props.setProgFilterOpen(true)} />
              {/* GARDE-FOU : masqué, jamais coché-mais-inerte — sans cégep
                  rattaché ou sans catalogue, ce filtre ne peut rien rendre. */}
              {props.monCegepAUnCatalogue && (
                <TogglePill active={props.offertParMonCegep} label="Offert chez nous"
                  onTap={() => props.setOffertParMonCegep(!props.offertParMonCegep)} />
              )}
              <TogglePill active={props.filterOuvertPrive} label="Privé" onTap={() => props.setFilterOuvertPrive(!props.filterOuvertPrive)} />
              <TogglePill active={props.filterOuvertAnglophone} label="Anglophone" onTap={() => props.setFilterOuvertAnglophone(!props.filterOuvertAnglophone)} />
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

      {/* MobilePickers — rendus APRÈS le sheet pour stacking z-index correct */}
      <MobilePicker open={openSport} onClose={() => setOpenSport(false)} title="Sport" options={SPORTS} value={props.sport} onChange={(v) => props.setSport((v as string) ?? "")} />
      <MobilePicker open={openGender} onClose={() => setOpenGender(false)} title="Genre d'équipe" options={TEAM_GENDER_FILTER_OPTIONS} value={props.genderFilter} onChange={(v) => props.setGenderFilter((v as string) ?? "")} />
      <MobilePicker open={openPosition} onClose={() => setOpenPosition(false)} title="Position" options={props.positionOptions} value={props.position} onChange={(v) => props.setPosition((v as string) ?? "")} />
      <MobilePicker open={openPromotion} onClose={() => setOpenPromotion(false)} title="Promotion" options={PROMOTION_OPTIONS} value={props.promotion} onChange={(v) => props.setPromotion((v as string) ?? "")} />
      <MobilePicker open={openRegion} onClose={() => setOpenRegion(false)} title="Région" options={props.regionOptions} value={props.region} onChange={(v) => props.setRegion((v as string) ?? "")} />
      <MobilePicker open={openOrg} onClose={() => setOpenOrg(false)} title="Organisation" options={ORG_OPTIONS} value={props.orgType} onChange={(v) => props.setOrgType((v as string) ?? "")} />
      <MobilePicker open={openGpa} onClose={() => setOpenGpa(false)} title="GPA minimum" options={GPA_OPTIONS} value={props.minGpa} onChange={(v) => props.setMinGpa((v as string) ?? "")} />
      <MobilePicker open={openSort} onClose={() => setOpenSort(false)} title="Trier par" options={SORT_OPTIONS.map((s) => ({ value: s.value, label: s.label }))} value={props.sortBy} onChange={(v) => props.setSortBy((v as string) ?? "rating_desc")} />

      <style jsx>{`
        @keyframes nx-modal-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nx-modal-slideup { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>,
    document.body,
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

/* ── EmptyState ────────────────────────────────────────────── */

function EmptyState({ hasFilters, onReset }: { hasFilters: boolean; onReset: () => void }) {
  return (
    <SharedEmptyState
      image="/empty/nexus-empty-recherche.png"
      title="Aucun athlète trouvé"
      description="Essaie d'élargir tes critères de recherche."
      action={hasFilters ? {
        label: "Réinitialiser les filtres",
        onClick: () => { triggerHaptic("Light"); onReset(); },
      } : undefined}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */

export function RecruteurRechercheMobile() {
  const searchParams = useSearchParams();
  /* maxSearchResults n'est plus lu : la RPC ne plafonne plus (p_limit NULL).
     `tier` ne sert qu'à la portée du cache et au gel du champ de recherche
     par nom — jamais au masquage, tranché serveur par ligne. */
  const { maxFavorites, tier, loading: tierLoading } = useSubscription();
  const isFreeRecruiter = tier === "free";
  const queryClient = useQueryClient();
  const toast = useMobileToast();
  const { data: currentUser } = useCurrentUser();
  const { data: favoritesArr = [] } = useFavorites();
  const { data: favCounts = {} } = useFavoriteCounts();
  const { data: regionsArr = [] } = useRegions();
  const favorites = useMemo(() => new Set(favoritesArr), [favoritesArr]);

  // Filter states
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("");
  // Genre d'ÉQUIPE (teams.gender), PAS athletes.genre. teamGender arrive déjà
  // mappé par useAthleteSearch (partagé avec le web) — ici il n'y a que l'UI.
  const [genderFilter, setGenderFilter] = useState<string>("");
  const [position, setPosition] = useState("");
  const [promotion, setPromotion] = useState("");
  const [region, setRegion] = useState("");
  const [orgType, setOrgType] = useState("");
  const [minGpa, setMinGpa] = useState("");
  const [sortBy, setSortBy] = useState("rating_desc");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [withVideoOnly, setWithVideoOnly] = useState(false);
  const [minRating, setMinRating] = useState("");
  const [withSportBadge, setWithSportBadge] = useState(false);
  const [withAcademicBadge, setWithAcademicBadge] = useState(false);
  const [hideFavorites, setHideFavorites] = useState(false);
  const [filterOuvertDemenager, setFilterOuvertDemenager] = useState(false);
  const [filterOuvertPrive, setFilterOuvertPrive] = useState(false);
  /* T2 — filtre par programme CÉGEP. Le picker rend des LIBELLÉS, la RPC
     filtre par PROGRAMME : la conversion passe par le catalogue. */
  const [progFilterIds, setProgFilterIds] = useState<string[]>([]);
  const [progFilterOpen, setProgFilterOpen] = useState(false);
  const [offertParMonCegep, setOffertParMonCegep] = useState(false);
  const { data: catalogueProg } = useCegepPrograms();
  const { data: monCegepAUnCatalogue = false } = useMonCegepOffreDesProgrammes();
  const progFilterProgramIds = [...new Set(
    (catalogueProg ?? []).filter((l) => progFilterIds.includes(l.id)).map((l) => l.programId))];
  const [filterOuvertAnglophone, setFilterOuvertAnglophone] = useState(false);
  const [filterNewOnly, setFilterNewOnly] = useState(searchParams?.get("nouveau") === "true");

  // UI states
  const [showFilters, setShowFilters] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const debouncedSearch = useDebouncedValue(search, 250);
  const { data: posData } = usePositionsBySport(sport || null);
  const sportId = posData?.sportId ?? null;
  const positionOptions: PickerOption[] = useMemo(() => {
    const opts: PickerOption[] = [{ value: "", label: "Toutes les positions" }];
    if (posData?.positions) {
      for (const p of posData.positions) {
        opts.push({ value: p.abbr || p.label, label: `${p.label}${p.abbr ? ` (${p.abbr})` : ""}` });
      }
    }
    return opts;
  }, [posData]);
  const regionOptions: PickerOption[] = useMemo(() => {
    const opts: PickerOption[] = [{ value: "", label: "Toutes les régions" }];
    for (const r of regionsArr) opts.push({ value: r, label: r });
    return opts;
  }, [regionsArr]);

  // Scroll listener (top bar blur + pull-to-refresh)
  const [scrollY, setScrollY] = useState(0);
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

  // Pull-to-refresh
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const PULL_THRESHOLD = 80;
  useEffect(() => {
    let startY = 0; let current = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (showFilters || searchExpanded) return;
      if ((window.scrollY || 0) === 0) startY = e.touches[0].clientY; else startY = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (showFilters || searchExpanded) return;
      if ((window.scrollY || 0) !== 0 || startY === 0) return;
      current = Math.max(0, Math.min(e.touches[0].clientY - startY, 120));
      setPullDistance(current);
      setIsPulling(current > 0);
    };
    const onTouchEnd = async () => {
      if (showFilters || searchExpanded) return;
      if (current >= PULL_THRESHOLD && !isRefreshing) {
        setIsRefreshing(true);
        triggerHaptic("Medium");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["athletes"] }),
          queryClient.invalidateQueries({ queryKey: ["favorites"] }),
          queryClient.invalidateQueries({ queryKey: ["favoriteCounts"] }),
        ]);
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
  }, [showFilters, searchExpanded, isRefreshing, queryClient]);

  // Athlete search
  const { data: athletes = [], isLoading: athletesLoading } = useAthleteSearch({
    search: debouncedSearch,
    sport,
    promotion,
    verifiedOnly,
    withVideoOnly,
    minRating,
    filterOuvertDemenager,
    filterOuvertPrive,
    filterOuvertAnglophone,
    filterNewOnly,
    minGpa,
    sortBy,
    sportId,
    programmeIds: progFilterProgramIds,
    // Jamais true quand le bouton est masqué : la RPC lèverait.
    offertParMonCegep: offertParMonCegep && monCegepAUnCatalogue,
    tier,
  });
  const loading = tierLoading || athletesLoading;

  // Client-side filters + favorites composition
  const filtered = useMemo(() => {
    let list = [...athletes];
    if (position) list = list.filter((a) => a.position === position);
    if (region) list = list.filter((a) => a.region === region);
    // Sans équipe → teamGender null → sort des résultats dès qu'un genre est choisi.
    if (genderFilter) list = list.filter((a) => a.teamGender === genderFilter);
    if (orgType) list = list.filter((a) => a.orgType === orgType);
    if (withSportBadge) list = list.filter((a) => a.badges.length > 0);
    if (withAcademicBadge) list = list.filter((a) => a.academicBadges && a.academicBadges.length > 0);
    if (hideFavorites) list = list.filter((a) => !favorites.has(a.id));
    if (sortBy === "favorites_desc" || sortBy === "plus_vus") {
      // "plus_vus" → fallback sur favCounts (proxy popularité) en attendant agrégat dédié
      list = [...list].sort((a, b) => (favCounts[b.id] || 0) - (favCounts[a.id] || 0));
    }
    return list.map((a) => ({ ...a, isFavorited: favorites.has(a.id), favorites: favCounts[a.id] || 0 }));
  }, [athletes, position, region, genderFilter, orgType, withSportBadge, withAcademicBadge, hideFavorites, sortBy, favorites, favCounts]);

  // Active filters count (badge)
  const activeFiltersCount = [
    sport, genderFilter, position, promotion, region, orgType, minGpa,
    verifiedOnly, withVideoOnly, minRating, withSportBadge, withAcademicBadge,
    hideFavorites, filterOuvertDemenager, filterOuvertPrive, filterOuvertAnglophone,
    filterNewOnly, sortBy !== "rating_desc",
  ].filter(Boolean).length;
  const hasFilters = activeFiltersCount > 0 || search.length > 0;

  const resetFilters = useCallback(() => {
    setSport(""); setGenderFilter(""); setPosition(""); setPromotion(""); setRegion(""); setOrgType(""); setMinGpa("");
    setSortBy("rating_desc");
    setVerifiedOnly(false); setWithVideoOnly(false); setMinRating("");
    setWithSportBadge(false); setWithAcademicBadge(false); setHideFavorites(false);
    setFilterOuvertDemenager(false); setFilterOuvertPrive(false); setFilterOuvertAnglophone(false);
    setFilterNewOnly(false);
  }, []);

  // Reset position si sport change
  useEffect(() => { setPosition(""); }, [sport]);

  // toggleFav avec invalidations TanStack + toast
  const toggleFav = async (id: string) => {
    const supabase = createClient();
    const userId = currentUser?.authUser.id;
    if (!userId) return;
    const isFav = favorites.has(id);
    const atCap = maxFavorites !== -1 && favorites.size >= maxFavorites;
    if (!isFav && atCap) {
      toast.warning({ message: "Limite de favoris atteinte", detail: "Favoris supplémentaires réservés aux membres Pro" });
      return;
    }
    const { data: existing } = await supabase
      .from("recruiter_favorites").select("id")
      .eq("recruiter_id", userId).eq("athlete_id", id).maybeSingle();
    if (existing) {
      await supabase.from("recruiter_favorites").delete().eq("id", existing.id);
      toast.info({ message: "Retiré des favoris" });
    } else {
      await supabase.from("recruiter_favorites").insert({ recruiter_id: userId, athlete_id: id });
      toast.success({ message: "Ajouté aux favoris" });
    }
    queryClient.invalidateQueries({ queryKey: ["favorites"] });
    queryClient.invalidateQueries({ queryKey: ["favoriteCounts"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", "kpi"] });
  };

  const atFavCap = maxFavorites !== -1 && favorites.size >= maxFavorites;

  // Mount stagger : ne déclencher qu'au premier render
  const hasStaggeredRef = useRef(false);
  useEffect(() => {
    if (!loading && filtered.length > 0 && !hasStaggeredRef.current) {
      hasStaggeredRef.current = true;
    }
  }, [loading, filtered.length]);

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
              style={{ animation: isRefreshing ? "nx-rotate 1s linear infinite" : "none" }}>
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </div>
          <style jsx>{`@keyframes nx-rotate { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      <MobileSearchBar
        search={search}
        onSearchChange={setSearch}
        activeFiltersCount={activeFiltersCount}
        onOpenFilters={() => setShowFilters(true)}
        scrolled={scrolled}
        disabled={isFreeRecruiter && false /* on permet le tap pour l'overlay même free */}
        placeholder={isFreeRecruiter ? "Recherche par nom (Pro)" : "Rechercher un athlète…"}
        onExpand={() => setSearchExpanded(true)}
        viewMode={viewMode}
        onToggleViewMode={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
        showViewToggle
      />

      {/* Iter 2b — count seul, right-aligned. Le segmented view-toggle a
          migré dans MobileSearchBar (bouton unique au top). */}
      <div className="px-4 py-2 flex items-center justify-end">
        <span className="text-[12px] font-bold text-[#6B7280]">
          {loading ? "Chargement…" : `${filtered.length} athlète${filtered.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Content with crossfade between grid/list */}
      <AnimatePresence mode="wait">
        {loading && athletes.length === 0 ? (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <SkeletonGrid />
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <EmptyState hasFilters={hasFilters} onReset={() => { resetFilters(); setSearch(""); }} />
          </motion.div>
        ) : (
          <motion.div
            key={viewMode}
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
                      {/* Plus de prop isFree : la Recherche est basculée sur
                          la RPC, donc `a.identityVisible` porte la décision. */}
                      <AthleteCardMobile
                        a={a as Parameters<typeof AthleteCardMobile>[0]["a"]}
                        favDisabled={atFavCap && !a.isFavorited}
                        onToggleFav={toggleFav}
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
                      <AthleteRowMobile
                        a={a as Parameters<typeof AthleteRowMobile>[0]["a"]}
                        favDisabled={atFavCap && !a.isFavorited}
                        onToggleFav={toggleFav}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters bottom sheet */}
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
        orgType={orgType} setOrgType={setOrgType}
        minGpa={minGpa} setMinGpa={setMinGpa}
        sortBy={sortBy} setSortBy={setSortBy}
        verifiedOnly={verifiedOnly} setVerifiedOnly={setVerifiedOnly}
        withVideoOnly={withVideoOnly} setWithVideoOnly={setWithVideoOnly}
        withSportBadge={withSportBadge} setWithSportBadge={setWithSportBadge}
        withAcademicBadge={withAcademicBadge} setWithAcademicBadge={setWithAcademicBadge}
        hideFavorites={hideFavorites} setHideFavorites={setHideFavorites}
        filterOuvertDemenager={filterOuvertDemenager} setFilterOuvertDemenager={setFilterOuvertDemenager}
        filterOuvertPrive={filterOuvertPrive} setFilterOuvertPrive={setFilterOuvertPrive}
        progFilterIds={progFilterIds} setProgFilterOpen={setProgFilterOpen}
        monCegepAUnCatalogue={monCegepAUnCatalogue}
        offertParMonCegep={offertParMonCegep} setOffertParMonCegep={setOffertParMonCegep}
        filterOuvertAnglophone={filterOuvertAnglophone} setFilterOuvertAnglophone={setFilterOuvertAnglophone}
        minRating={minRating} setMinRating={setMinRating}
        positionOptions={positionOptions}
        regionOptions={regionOptions}
      />
      <ProgrammeCegepPicker open={progFilterOpen} onClose={() => setProgFilterOpen(false)}
        value={progFilterIds} onChange={setProgFilterIds} />

      {/* Expanded search overlay */}
      <AnimatePresence>
        {searchExpanded && (
          <ExpandedSearchOverlay
            search={search}
            onSearchChange={setSearch}
            onClose={() => setSearchExpanded(false)}
            isFreeRecruiter={isFreeRecruiter}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
