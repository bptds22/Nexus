"use client";

/* ═══════════════════════════════════════════════════════════════
   Calendrier de recrutement — portail recruteur.

   Port 1:1 de docs/reference/calendrier-recruteur-ref.html
   (SHA-256 CEBAA004…3C7E). La réf est pixel-finale : aucune décision
   de design n'est prise ici, seules les données sont branchées.

   Portail recruteur = PLATEFORME → rouge Nexus légitime, Outfit,
   vouvoiement.
═══════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useRegions } from "@/lib/queries/shared/useRegions";
import { usePositionsBySport } from "@/lib/queries/recruiter/usePositionsBySport";
import { useListesUnite } from "@/lib/queries/recruiter/useListesUnite";
import {
  todayIso,
  type CalendarTarget,
} from "@/lib/queries/recruiter/useRecruitingCalendar";
import { useCalendrierUnite, type VisiteUnite, type RelanceUnite } from "@/lib/queries/recruiter/useCalendrierUnite";
import { usePreferenceLocale } from "@/lib/recherche/useFiltresRecherche";
import {
  buildMatches,
  buildMonthGrid,
  dayNumber,
  EMPTY_FILTERS,
  filterTargets,
  weekKey,
  weekLabel,
  hasActiveFilters,
  matchesOnDay,
  monthLabel,
  shortMonthLabel,
  type CalendarFilters,
  type CalendarSort,
  type MatchView,
} from "@/lib/calendar/recruitingCalendar";
import FeatureGate from "@/components/subscription/FeatureGate";
import SourceMatchLigne from "@/components/shared/SourceMatchLigne";
import { heureCarte } from "@/lib/calendar/heureMatch";
import StarRating from "@/components/ui/StarRating";
import { aUneCote } from "@/lib/evaluations/presence";
import { RecruteurCalendrierMobile } from "@/components/shared/RecruteurCalendrierMobile";
import BoutonAbonnementAgenda from "@/components/recruteur/agenda/BoutonAbonnementAgenda";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* Sous-ensemble des sports de la page Recherche. */
const SPORTS = [
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

const PROMOTIONS = ["2026", "2027", "2028"];

/* Stages de recruiter_pipeline (chk_recruiter_pipeline_stage). */
const STAGES: { value: string; label: string }[] = [
  { value: "IDENTIFIE", label: "Identifié" },
  { value: "CONTACTE", label: "Contacté" },
  { value: "EN_DISCUSSION", label: "En discussion" },
  { value: "VISITE_PLANIFIEE", label: "En visite" },
  { value: "ENGAGE", label: "Engagé" },
  { value: "LETTRE_SIGNEE", label: "Lettre signée" },
];

const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  STAGES.map((s) => [s.value, s.label]),
);

const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/* ── Les trois types d'événements (amélioration du calendrier, 2026-09-28) ──
   Décision BP 2026-09-28 : rouge = matchs (la couleur du produit) ; vert =
   visites ; ambre = relances. Le vert n'est plus réservé aux messages et
   l'ambre marque les relances ici (registre §42). Le bleu reste au badge
   vérifié. */
const COULEUR = { m: "#E63946", v: "#22C55E", r: "#F59E0B" } as const;
type TypeEvenement = keyof typeof COULEUR;
const TYPES: { cle: TypeEvenement; libelle: string }[] = [
  { cle: "m", libelle: "Matchs" },
  { cle: "v", libelle: "Visites" },
  { cle: "r", libelle: "Relances" },
];
/* Le choix est mémorisé (localStorage) : une combinaison de lettres, « - »
   quand aucun type n'est actif. */
const COMBINAISONS = ["mvr", "mv", "mr", "vr", "m", "v", "r", "-"] as const;
type Combinaison = (typeof COMBINAISONS)[number];

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

/* ── Primitives de la réf ──────────────────────────────────── */

const Chevron = ({ className = "" }: { className?: string }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CalendarIcon = ({ size = 15, strokeWidth = 2.2 }: { size?: number; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

/** Select de filtre — classes `nx-filter-select` / `nx-filter-active` de la
 *  plateforme, identiques à recherche/page.tsx. Aucun style local. */
function FilterSelect({
  value, onChange, disabled, active, ariaLabel, children,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  active?: boolean;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className={`nx-filter-select${active ? " nx-filter-active" : ""}`}
    >
      {children}
    </select>
  );
}

/** Multi-sélection : chaque choix s'ajoute, la pastille teintée porte un ×
 *  pour tout effacer. Métriques alignées sur `nx-filter-select` (13px / 600 /
 *  8-14px / rounded-full) pour que la rangée reste homogène — un <select>
 *  natif ne peut pas héberger le bouton ×, d'où le wrapper. */
function MultiFilterSelect({
  values, onAdd, onClear, placeholder, renderLabel, children,
}: {
  values: string[];
  onAdd: (v: string) => void;
  onClear: () => void;
  placeholder: string;
  renderLabel: (values: string[]) => string;
  children: React.ReactNode;
}) {
  const active = values.length > 0;
  return (
    <div
      className={`relative inline-flex items-center rounded-full border text-[13px] font-semibold text-white transition-colors ${
        active
          ? "border-[#E63946] bg-[rgba(230,57,70,0.08)]"
          : "border-[#3a3f4b] bg-[#1A1D24] hover:border-[#555a66] hover:bg-[#1E2128]"
      }`}
    >
      <select
        value=""
        onChange={(e) => { if (e.target.value) onAdd(e.target.value); }}
        className={`cursor-pointer appearance-none whitespace-nowrap bg-transparent py-2 pl-[14px] text-[13px] font-semibold outline-none ${active ? "pr-1.5" : "pr-9"}`}
      >
        <option value="">{active ? renderLabel(values) : placeholder}</option>
        {children}
      </select>
      {active ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Effacer le filtre"
          className="pl-0.5 pr-[12px] text-[14px] font-normal leading-none text-[#9CA3AF] transition-colors hover:text-white"
        >
          ×
        </button>
      ) : (
        <Chevron className="pointer-events-none absolute right-[12px] opacity-60" />
      )}
    </div>
  );
}

/** Chip — même rendu que les quick presets de recherche/page.tsx. */
function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${
        on
          ? "border-[#E63946]/30 bg-[#E63946]/15 text-[#E63946]"
          : "border-[#2D3748] bg-[#13151a] text-[#6b7280] hover:border-[#4a4d56] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/** `.av` — pastille d'initiales. */
function Avatar({ text, more = false, className = "" }: { text: string; more?: boolean; className?: string }) {
  return (
    <div
      className={`w-[34px] h-[34px] rounded-full border-2 border-[#1A1D24] flex items-center justify-center font-bold shrink-0 ${
        more ? "bg-[#B32330] text-white text-[11.5px]" : "bg-[#20242C] text-[#B9BFC9] text-[12px]"
      } ${className}`}
    >
      {text}
    </div>
  );
}

/** `.stg` — pastille de stage pipeline. `VISITE_PLANIFIEE` est le seul
 *  stage que la réf distingue (vert). Une cible venue d'un favori ou
 *  d'une liste seule n'a aucun stage : on n'affiche alors pas de
 *  pastille plutôt que d'inventer un libellé. */
function StagePill({ stage }: { stage: string | null }) {
  if (!stage) return null;
  const label = STAGE_LABEL[stage] ?? stage;
  const isVisit = stage === "VISITE_PLANIFIEE";
  return (
    <span
      className={`shrink-0 rounded-full px-[10px] py-[3px] text-[11.5px] font-semibold tracking-[0.04em] whitespace-nowrap ${
        isVisit
          ? "bg-[rgba(34,197,94,0.10)] border border-[rgba(34,197,94,0.30)] text-[#22C55E]"
          : "bg-[#20242C] text-[#B9BFC9]"
      }`}
    >
      {label}
    </span>
  );
}

/* ── Visite planifiée de l'unité (lot B2, étape 3) ─────────────────
   Un événement du calendrier au même titre qu'un match : la date posée
   dans le processus (recruiter_pipeline.visit_at), par n'importe quel
   recruteur de l'unité. */
function VisiteCard({ v }: { v: VisiteUnite }) {
  const d = new Date(v.visitAt);
  const heure = d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
  const aHeure = !(d.getHours() === 0 && d.getMinutes() === 0);
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[rgba(34,197,94,0.30)] bg-[#1A1D24] px-5 py-4">
      <div className="w-[64px] shrink-0 text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#22C55E]">{shortMonthLabel(v.jour)}</div>
        <div className="text-[24px] font-extrabold leading-none text-[#EDEFF3]">{dayNumber(v.jour)}</div>
        {aHeure && <div className="mt-1 text-[12px] text-[#8A909C]">{heure}</div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#22C55E]">Visite</span>
          <Link href={lienCible(v.athleteId, v.prospect)} className="truncate text-[16px] font-bold text-[#EDEFF3] hover:text-[#E63946]">
            {v.fullName}
          </Link>
          {v.prospect && <PastilleProspect />}
        </div>
        {v.suiviPar.length > 0 && (
          <div className="mt-0.5 truncate text-[13px] text-[#8A909C]">Suivi par {v.suiviPar.join(", ")}</div>
        )}
      </div>
      <StagePill stage={v.stage} />
    </div>
  );
}

/* ── Relance de l'unité — à sa date d'échéance ─────────────────── */
function RelanceCard({ r }: { r: RelanceUnite }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[rgba(245,158,11,0.30)] bg-[#1A1D24] px-5 py-4">
      <div className="w-[64px] shrink-0 text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#F59E0B]">{shortMonthLabel(r.jour)}</div>
        <div className="text-[24px] font-extrabold leading-none text-[#EDEFF3]">{dayNumber(r.jour)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#F59E0B]">Relance</span>
          {r.enRetard && (
            <span className="rounded-full border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.10)] px-2 py-[1px] text-[11px] font-bold uppercase tracking-[0.06em] text-[#F59E0B]">
              En retard
            </span>
          )}
          <Link href={lienCible(r.athleteId, r.prospect)} className="truncate text-[16px] font-bold text-[#EDEFF3] hover:text-[#E63946]">
            {r.fullName}
          </Link>
          {r.prospect && <PastilleProspect />}
        </div>
        {r.note && <div className="mt-0.5 truncate text-[13.5px] text-[#B9BFC9]">{r.note}</div>}
        {r.suiviPar.length > 0 && (
          <div className="mt-0.5 truncate text-[13px] text-[#8A909C]">Suivi par {r.suiviPar.join(", ")}</div>
        )}
      </div>
      <StagePill stage={r.stage} />
    </div>
  );
}

/** Carte prospect (lot C) : athlète pas encore sur Nexus, suivi par l'unité. */
function PastilleProspect() {
  return (
    <span
      className="inline-flex items-center rounded-full border border-[#9CA3AF]/40 bg-white/5 px-2 py-[1px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#D1D5DB]"
      title="Carte prospect : pas encore sur Nexus"
    >
      Prospect
    </span>
  );
}

/** Lien du nom : la fiche Nexus, ou — pour une carte prospect — son panneau
 *  dans Mon processus (?athlete= retrouve la carte par son id). */
function lienCible(id: string, prospect?: boolean): string {
  return prospect ? `/recruteur/pipeline?athlete=${id}` : `/recruteur/athletes/${id}`;
}

/** `.tgt` — une cible dans le détail déplié. */
function TargetRow({ t }: { t: CalendarTarget }) {
  return (
    <div className="flex items-center gap-3 py-2 border-t border-[#1E2129] first:border-t-0">
      <Avatar text={t.initials} className="!w-8 !h-8 !border-[#171A20]" />
      <div className="flex-1 min-w-0">
        <b className="flex flex-wrap items-center gap-x-2 text-[14.5px] font-semibold leading-[1.3] text-[#EDEFF3]">
          <span>
            {t.firstName} {t.lastName}
            {t.verified && <span className="text-[#3B82F6]"> ✓</span>}
          </span>
          {t.prospect && <PastilleProspect />}
          {/* Cote coach — composant étoiles partagé de la plateforme, même
              rendu que les cartes de la Recherche. Athlète non coté : rien,
              pas de « N/A ». */}
          {aUneCote(t.stars) && <StarRating rating={t.stars} size="sm" />}
        </b>
        <i className="not-italic text-[12.5px] text-[#8A909C]">
          {[t.position, t.graduationYear ? `Promotion ${t.graduationYear}` : ""]
            .filter(Boolean)
            .join(" · ")}
        </i>
      </div>
      <StagePill stage={t.pipelineStage} />
    </div>
  );
}

/** Colonne d'équipe du détail déplié. */
function DetailColumn({ name, targets, className = "" }: { name: string; targets: CalendarTarget[]; className?: string }) {
  return (
    <div className={`px-[22px] py-[18px] ${className}`}>
      <div className="mb-3 text-[13px] font-bold tracking-[0.1em] uppercase text-[#B9BFC9]">
        {name}
        <span className="ml-2 text-[12.5px] font-medium tracking-normal normal-case text-[#5C6575]">
          {targets.length} cible{targets.length > 1 ? "s" : ""}
        </span>
      </div>
      {targets.length === 0 ? (
        <div className="text-[13.5px] italic text-[#5C6575]">Aucune de vos cibles dans cette équipe.</div>
      ) : (
        targets.map((t) => <TargetRow key={`${t.athleteId}-${t.teamId}`} t={t} />)
      )}
    </div>
  );
}

/** `.match` — carte de match. Partagée par la vue Liste et la vue
 *  Calendrier (cartes du jour rendues sous la grille). */
function MatchCard({ m }: { m: MatchView }) {
  const [open, setOpen] = useState(false);
  const stack = [...m.homeTargets, ...m.visitorTargets];
  const shown = stack.slice(0, 3);
  const extra = stack.length - shown.length;

  return (
    <div
      className={`bg-[#1A1D24] border border-[#262A33] rounded-2xl overflow-hidden transition-colors hover:border-[#333B4A] ${
        m.hot ? "border-l-[3px] border-l-[#E63946]" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-[22px] px-[22px] py-[18px] text-left text-[#EDEFF3] flex-wrap sm:flex-nowrap"
      >
        {/* Bloc date */}
        <div className="w-16 shrink-0 text-center">
          <div className="text-[30px] font-extrabold leading-none tracking-[-0.02em]">
            {dayNumber(m.game.gameDate)}
          </div>
          <div className="mt-[3px] text-[12px] font-bold uppercase tracking-[0.1em] text-[#E63946]">
            {shortMonthLabel(m.game.gameDate)}
          </div>
        </div>

        {/* Matchup + meta */}
        <div className="flex-1 min-w-0">
          {m.hot && (
            <span className="mb-1.5 inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[#E63946]">
              ★ Match à fort potentiel
            </span>
          )}
          <div className="text-[17px] font-bold leading-[1.35]">
            {m.game.homeName}
            <span className="px-1 text-[14.5px] font-medium text-[#5C6575]">vs</span>
            {m.game.visitorName}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-[14px] gap-y-1.5 text-[14.5px] font-medium text-[#8A909C]">
            {/* Même lecture et même format que la carte des matchs : « 18 h 30 »,
                jamais le texte brut de la source (« 6:30 PM »). */}
            {m.game.gameTime && <span data-testid="heure-match">{heureCarte(m.game.gameTime)}</span>}
            {m.game.venue && <span>{m.game.venue}</span>}
            {m.game.competition && <span className="text-[#5C6575]">{m.game.competition}</span>}
          </div>
        </div>

        {/* Compteur */}
        <div className="flex shrink-0 items-center gap-[14px] max-sm:w-full max-sm:justify-end">
          <div className="flex">
            {shown.map((t, i) => (
              <Avatar
                key={`${t.athleteId}-${t.teamId}`}
                text={t.initials}
                className={i === 0 ? "" : "-ml-[9px]"}
              />
            ))}
            {extra > 0 && <Avatar text={`+${extra}`} more className="-ml-[9px]" />}
          </div>
          <span className="inline-flex items-center gap-[7px] whitespace-nowrap rounded-full border border-[rgba(230,57,70,0.28)] bg-[rgba(230,57,70,0.09)] px-[15px] py-[7px] text-[14px] font-semibold text-[#EDEFF3]">
            <b className="font-extrabold text-[#E63946]">{m.count}</b> cible{m.count > 1 ? "s" : ""}
          </span>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`shrink-0 text-[#5C6575] transition-transform duration-[250ms] ${open ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Provenance — HORS du <button> : un lien ne s'imbrique pas dans un
          bouton (HTML invalide, et le clic partirait dans les deux). */}
      <SourceMatchLigne source={m.game.source} />

      {open && (
        <div className="grid grid-cols-1 border-t border-[#1E2129] bg-[#171A20] md:grid-cols-2">
          <DetailColumn name={m.game.homeName} targets={m.homeTargets} />
          <DetailColumn
            name={m.game.visitorName}
            targets={m.visitorTargets}
            className="border-t border-[#1E2129] md:border-t-0 md:border-l"
          />
        </div>
      )}
    </div>
  );
}

/* ── Planches d'états ──────────────────────────────────────── */

function EmptyBoard() {
  return (
    <div className="mt-[34px] rounded-2xl border border-[#262A33] bg-[#1A1D24] px-[30px] py-[60px] text-center">
      <div className="mb-[18px] inline-flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#20242C] text-[#8A909C]">
        <CalendarIcon size={26} strokeWidth={1.8} />
      </div>
      <h3 className="mb-2 text-[20px] font-bold text-[#EDEFF3]">Aucun match à venir pour vos cibles</h3>
      <p className="mx-auto max-w-[520px] text-[15px] text-[#8A909C]">
        Leurs équipes ne sont pas encore reliées au calendrier RSEQ, ou la saison n&apos;est pas publiée.
        Les matchs apparaîtront automatiquement dès que les calendriers seront disponibles.{" "}
        <Link href="/recruteur/recherche" className="font-semibold text-[#E63946] no-underline">
          Explorer des athlètes →
        </Link>
      </p>
    </div>
  );
}

/** Vide contextuel : des matchs existent pour les cibles, mais le seuil ou
 *  les filtres les écartent tous. Distinct de la planche RSEQ, qui affirme
 *  qu'il n'y a aucun match — ce qui serait faux ici. */
function NoMatchForFilters({ minTargets, onReset }: { minTargets: number; onReset: () => void }) {
  return (
    <div className="mt-[34px] rounded-2xl border border-[#262A33] bg-[#1A1D24] px-[30px] py-[60px] text-center">
      <div className="mb-[18px] inline-flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#20242C] text-[#8A909C]">
        <CalendarIcon size={26} strokeWidth={1.8} />
      </div>
      <h3 className="mb-2 text-[20px] font-bold text-[#EDEFF3]">
        {minTargets > 1
          ? `Aucun match avec ${minTargets} cibles ou plus.`
          : "Aucun match ne correspond à vos filtres."}
      </h3>
      <p className="mx-auto max-w-[520px] text-[15px] text-[#8A909C]">
        {minTargets > 1
          ? "Réduisez le seuil ou élargissez vos filtres."
          : "Élargissez vos filtres pour retrouver des matchs."}{" "}
        <button type="button" onClick={onReset} className="font-semibold text-[#E63946]">
          Réinitialiser
        </button>
      </p>
    </div>
  );
}

/** Mur Free — planche `.board.lock` de la réf. Le fond flouté est le
 *  décor de la réf (fixture), pas de la donnée : aucune requête ne
 *  part pour un recruteur Free. */

/* ── Page ──────────────────────────────────────────────────── */

export default function CalendrierPage() {
  if (IS_CAPACITOR) return <RecruteurCalendrierMobile />;
  /* Pro depuis le 2026-09-28 (décision BP) : même verrou que Listes et Mon
     processus. FeatureGate ne MONTE PAS le contenu pour un gratuit — aucune
     requête ne part, rien n'est téléchargé puis masqué. */
  return (
    <FeatureGate feature="recruiting_calendar" requiredTier="pro">
      <CalendrierContent />
    </FeatureGate>
  );
}

function CalendrierContent() {
  const { tier, loading: tierLoading } = useSubscription();
  const isFree = tier === "free";

  const [filters, setFilters] = useState<CalendarFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<CalendarSort>("date");
  const [view, setView] = useState<"list" | "cal">("list");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const today = useMemo(() => todayIso(), []);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Le mur Free ne monte aucune requête : le contenu n'est pas
  // téléchargé puis masqué, il n'est jamais demandé.
  // Lot B2, étape 3 : le calendrier de l'UNITÉ — cibles de tous les
  // collègues, et leurs visites planifiées (useCalendrierUnite).
  const { data, isLoading, isError } = useCalendrierUnite(!isFree && !tierLoading);
  const { data: regions = [] } = useRegions();
  const { data: lists = [] } = useListesUnite(!isFree && !tierLoading);
  const { data: posData } = usePositionsBySport(filters.sport || null);
  const positions = posData?.positions ?? [];

  const targets = data?.targets ?? [];
  const games = data?.games ?? [];
  const visites = useMemo(() => data?.visites ?? [], [data]);
  const relances = useMemo(() => data?.relances ?? [], [data]);

  /* Types affichés — tous actifs par défaut, choix mémorisé. */
  const [combinaison, setCombinaison] = usePreferenceLocale<Combinaison>("nexus:calendrier:types", "mvr", COMBINAISONS);
  const actifs = useMemo(
    () => ({ m: combinaison.includes("m"), v: combinaison.includes("v"), r: combinaison.includes("r") }),
    [combinaison],
  );
  const basculerType = (t: TypeEvenement) => {
    const suivant = TYPES.map((x) => x.cle).filter((c) => (c === t ? !actifs[c] : actifs[c])).join("");
    setCombinaison((suivant || "-") as Combinaison);
  };


  const matches = useMemo(
    () => buildMatches(games, filterTargets(targets, filters), sort, filters.minTargets),
    [games, targets, filters, sort],
  );
  // Référence sans aucun filtre ni seuil : sert à distinguer « vos cibles
  // n'ont aucun match RSEQ » (planche vide) de « des matchs existent mais
  // rien ne passe le seuil / les filtres » (message contextuel).
  const baseMatchCount = useMemo(
    () => buildMatches(games, targets, sort).length,
    [games, targets, sort],
  );
  /* VUE LISTE (retour BP) : UNE liste chronologique — matchs, visites et
     relances mêlés par date, différenciés par leur couleur ; les pastilles
     du haut filtrent les types. Même jour : relances, puis visites, puis
     matchs (ce qui est à faire avant ce qui est à voir). */
  const semaines = useMemo(() => {
    type Ev =
      | { type: "r"; jour: string; cle: string; r: RelanceUnite }
      | { type: "v"; jour: string; cle: string; v: VisiteUnite }
      | { type: "m"; jour: string; cle: string; m: (typeof matches)[number] };
    const ordre = { r: 0, v: 1, m: 2 } as const;
    const evs: Ev[] = [
      ...(actifs.r ? relances.map((r): Ev => ({ type: "r", jour: r.jour, cle: `r-${r.athleteId}`, r })) : []),
      ...(actifs.v ? visites.map((v): Ev => ({ type: "v", jour: v.jour, cle: `v-${v.athleteId}`, v })) : []),
      ...(actifs.m ? matches.map((m): Ev => ({ type: "m", jour: m.game.gameDate, cle: `m-${m.game.id}`, m })) : []),
    ].sort((a, b) => a.jour.localeCompare(b.jour) || ordre[a.type] - ordre[b.type]);
    const parSemaine = new Map<string, Ev[]>();
    for (const e of evs) {
      const k = weekKey(e.jour);
      parSemaine.set(k, [...(parSemaine.get(k) ?? []), e]);
    }
    return [...parSemaine.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([cle, evenements]) => ({ cle, label: weekLabel(cle), evenements }));
  }, [actifs, relances, visites, matches]);
  const grid = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month, matches, today),
    [cursor, matches, today],
  );
  const dayMatches = useMemo(
    () => (selectedDay ? matchesOnDay(matches, selectedDay) : []),
    [matches, selectedDay],
  );
  /* Par jour, pour la vue mois : combien de matchs (★ si fort potentiel),
     de visites, de relances. */
  const parJour = useMemo(() => {
    const m = new Map<string, { matchs: number; hot: boolean; visites: number; relances: number }>();
    const caseDuJour = (iso: string) => {
      let c = m.get(iso);
      if (!c) { c = { matchs: 0, hot: false, visites: 0, relances: 0 }; m.set(iso, c); }
      return c;
    };
    for (const v of matches) { const c = caseDuJour(v.game.gameDate); c.matchs++; if (v.hot) c.hot = true; }
    for (const v of visites) caseDuJour(v.jour).visites++;
    for (const r of relances) caseDuJour(r.jour).relances++;
    return m;
  }, [matches, visites, relances]);
  const visitesDuJour = useMemo(
    () => (selectedDay ? visites.filter((v) => v.jour === selectedDay) : []),
    [visites, selectedDay],
  );
  const relancesDuJour = useMemo(
    () => (selectedDay ? relances.filter((r) => r.jour === selectedDay) : []),
    [relances, selectedDay],
  );

  const set = <K extends keyof CalendarFilters>(k: K, v: CalendarFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));

  const toggleIn = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  // Nav mois bornée : jamais avant le mois courant.
  const now = new Date();
  const atFirstMonth =
    cursor.year < now.getFullYear() ||
    (cursor.year === now.getFullYear() && cursor.month <= now.getMonth());

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    setSelectedDay(null);
  };

  return (
    <div className="mx-auto max-w-[1180px] px-[26px] pb-[90px] pt-10 font-sans text-[#EDEFF3]">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="font-head text-[clamp(28px,3.2vw,40px)] font-extrabold uppercase leading-[1.1] tracking-[-0.01em]">
            Calendrier de recrutement
          </h1>
          <div className="mt-1.5 text-[16px] font-normal text-[#B9BFC9]">
            Les matchs à recruter, les visites et les relances de ton unité
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
        {/* Flux d'agenda privé (relances + visites) — Pro, comme la page. */}
        <BoutonAbonnementAgenda />
        {/* Filtre des types d'événements — ensemble ou séparément, mémorisé. */}
        <div className="flex items-center gap-2" role="group" aria-label="Types d'événements">
          {TYPES.map((t) => {
            const on = actifs[t.cle];
            const c = COULEUR[t.cle];
            return (
              <button
                key={t.cle}
                type="button"
                aria-pressed={on}
                onClick={() => basculerType(t.cle)}
                className="flex items-center gap-2 rounded-full border px-[14px] py-[9px] text-[13.5px] font-semibold transition-colors"
                style={on
                  ? { borderColor: `${c}66`, backgroundColor: `${c}1A`, color: c }
                  : { borderColor: "#262A33", backgroundColor: "#1A1D24", color: "#5C6575" }}
              >
                <span className="inline-block h-[8px] w-[8px] rounded-full" style={{ backgroundColor: on ? c : "#3A404C" }} aria-hidden="true" />
                {t.libelle}
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-xl border border-[#262A33] bg-[#1A1D24]">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`flex items-center gap-2 px-[18px] py-[11px] text-[14px] font-semibold transition-all ${
              view === "list" ? "bg-[#E63946] text-white" : "text-[#8A909C] hover:text-[#EDEFF3]"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
              <circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" />
            </svg>
            Liste
          </button>
          <button
            type="button"
            onClick={() => setView("cal")}
            className={`flex items-center gap-2 px-[18px] py-[11px] text-[14px] font-semibold transition-all ${
              view === "cal" ? "bg-[#E63946] text-white" : "text-[#8A909C] hover:text-[#EDEFF3]"
            }`}
          >
            <CalendarIcon />
            Calendrier
          </button>
        </div>
        </div>
      </div>

      {/* ── Disclaimer ──
          « Basé sur le calendrier officiel RSEQ » et « Mis à jour le X » ont
          été RETIRÉS le 2026-09-17 : la première phrase était fausse pour les
          446 matchs venus de sites civils, la seconde affichait
          MAX(games.updated_at) — la dernière écriture toutes lignes confondues
          — sous des matchs relevés des semaines plus tôt. Source et fraîcheur
          sont désormais sur CHAQUE carte. Ce qui reste ici est vrai pour tous. */}
      <div className="mt-[18px] rounded-xl border border-[#1E2129] bg-[#1A1D24] px-4 py-3">
        <div className="text-[14.5px] text-[#8A909C]">
          Horaires et lieux <b className="font-semibold text-[#B9BFC9]">à confirmer à la source</b>{" "}
          avant de vous déplacer — chaque match indique d’où vient l’information.
        </div>
      </div>

      {(
        <>
          {/* ── Filtres — deux étages, pattern de recherche/page.tsx ── */}
          <div className="mt-[22px] space-y-3">
            {/* Rangée principale : toujours visible */}
            <div className="flex flex-wrap items-center gap-2.5">
              <FilterSelect
                value={filters.sport}
                active={!!filters.sport}
                ariaLabel="Sport"
                onChange={(v) => setFilters((f) => ({ ...f, sport: v, position: "" }))}
              >
                {SPORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </FilterSelect>

              <FilterSelect
                value={filters.position}
                active={!!filters.position}
                disabled={!filters.sport}
                ariaLabel="Position"
                onChange={(v) => set("position", v)}
              >
                <option value="">
                  {filters.sport ? "Toutes les positions" : "Sélectionner un sport d'abord"}
                </option>
                {positions.map((p) => <option key={p.abbr} value={p.abbr}>{p.abbr} — {p.label}</option>)}
              </FilterSelect>

              <MultiFilterSelect
                values={filters.promotions}
                placeholder="Toutes les promotions"
                renderLabel={(v) => (v.length === 1 ? `Promotion ${v[0]}` : `${v.length} promotions`)}
                onAdd={(v) => set("promotions", toggleIn(filters.promotions, v))}
                onClear={() => set("promotions", [])}
              >
                {PROMOTIONS.map((p) => (
                  <option key={p} value={p}>{filters.promotions.includes(p) ? `✓ ${p}` : p}</option>
                ))}
              </MultiFilterSelect>

              {/* Seuil de densité — pastille teintée + × dès qu'il dépasse 1+ */}
              <MultiFilterSelect
                values={filters.minTargets > 1 ? [String(filters.minTargets)] : []}
                placeholder="Cibles : 1+"
                renderLabel={(v) => `Cibles : ${v[0]}+`}
                onAdd={(v) => set("minTargets", Number(v))}
                onClear={() => set("minTargets", 1)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}+ cible{n > 1 ? "s" : ""}</option>
                ))}
              </MultiFilterSelect>

              <FilterSelect value={sort} ariaLabel="Trier" onChange={(v) => setSort(v as CalendarSort)}>
                <option value="date">Trier : date</option>
                <option value="density">Trier : densité</option>
              </FilterSelect>

              <div className="mx-1 hidden h-6 w-px bg-[#2D3748] sm:block" />

              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                  showAdvanced
                    ? "border border-[#E63946]/30 bg-[#E63946]/10 text-[#E63946]"
                    : "border border-[#2D3748] text-[#9CA3AF] hover:text-white"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                Filtres avancés
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {hasActiveFilters(filters) && (
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="nx-filter-reset ml-1 flex items-center gap-1.5 text-[13px] font-bold text-[#E63946] transition-colors hover:text-[#D42B22]"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                  </svg>
                  Réinitialiser
                </button>
              )}
            </div>

            {/* Panneau avancé — replié par défaut */}
            {showAdvanced && (
              <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-[#2a2d36] bg-[#13151a] p-3">
                <FilterSelect value={filters.region} active={!!filters.region} ariaLabel="Région" onChange={(v) => set("region", v)}>
                  <option value="">Toutes les régions</option>
                  {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                </FilterSelect>

                <FilterSelect value={filters.orgType} active={!!filters.orgType} ariaLabel="Organisation" onChange={(v) => set("orgType", v)}>
                  <option value="">Toutes les organisations</option>
                  <option value="scolaire">Scolaire</option>
                  <option value="ligue_civile">Ligue civile</option>
                </FilterSelect>

                <FilterSelect value={filters.minRating} active={!!filters.minRating} ariaLabel="Cote" onChange={(v) => set("minRating", v)}>
                  <option value="">Toutes les cotes</option>
                  <option value="1">★ 1+</option>
                  <option value="2">★★ 2+</option>
                  <option value="3">★★★ 3+</option>
                  <option value="4">★★★★ 4+</option>
                  <option value="5">★★★★★ 5</option>
                </FilterSelect>

                <FilterSelect value={filters.minGpa} active={!!filters.minGpa} ariaLabel="Moyenne" onChange={(v) => set("minGpa", v)}>
                  <option value="">Toutes les moyennes</option>
                  <option value="60">60 %+</option>
                  <option value="70">70 %+</option>
                  <option value="80">80 %+</option>
                  <option value="85">85 %+</option>
                  <option value="90">90 %+</option>
                </FilterSelect>

                <MultiFilterSelect
                  values={filters.listIds}
                  placeholder="Listes de l'unité"
                  renderLabel={(v) =>
                    v.length === 1
                      ? `Liste : ${lists.find((l) => l.id === v[0])?.name ?? "—"}`
                      : `${v.length} listes`
                  }
                  onAdd={(v) => set("listIds", toggleIn(filters.listIds, v))}
                  onClear={() => set("listIds", [])}
                >
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {filters.listIds.includes(l.id) ? `✓ ${l.name}` : l.name}
                    </option>
                  ))}
                </MultiFilterSelect>

                <FilterSelect value={filters.stage} active={!!filters.stage} ariaLabel="Statut pipeline" onChange={(v) => set("stage", v)}>
                  <option value="">Statut : tous</option>
                  {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </FilterSelect>

                <div className="mx-1 h-6 w-px bg-[#2D3748]" />

                <FilterChip on={filters.verifiedOnly} onClick={() => set("verifiedOnly", !filters.verifiedOnly)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill={filters.verifiedOnly ? "#E63946" : "none"} stroke={filters.verifiedOnly ? "#E63946" : "#6b7280"} strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                  Vérifié
                </FilterChip>
                <FilterChip on={filters.withVideoOnly} onClick={() => set("withVideoOnly", !filters.withVideoOnly)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={filters.withVideoOnly ? "#E63946" : "#6b7280"} strokeWidth="2" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
                  Avec vidéo
                </FilterChip>
              </div>
            )}
          </div>

          {/* ── Contenu ── */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-[14px] text-[#5C6575]">
              Chargement de votre calendrier…
            </div>
          ) : isError ? (
            /* Un échec de requête ne doit PAS emprunter la planche vide :
               « Aucun match à venir » affirmerait qu'il n'y en a pas,
               alors qu'on n'en sait rien. Même coquille que la réf,
               copie honnête. */
            <div className="mt-[34px] rounded-2xl border border-[#262A33] bg-[#1A1D24] px-[30px] py-[60px] text-center">
              <div className="mb-[18px] inline-flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#20242C] text-[#8A909C]">
                <CalendarIcon size={26} strokeWidth={1.8} />
              </div>
              <h3 className="mb-2 text-[20px] font-bold text-[#EDEFF3]">Calendrier momentanément indisponible</h3>
              <p className="mx-auto max-w-[520px] text-[15px] text-[#8A909C]">
                Les matchs n&apos;ont pas pu être chargés. Réessayez dans un moment.
              </p>
            </div>
          ) : !actifs.m && !actifs.v && !actifs.r ? (
            <div className="mt-[34px] rounded-2xl border border-[#262A33] bg-[#1A1D24] px-[30px] py-[40px] text-center text-[15px] text-[#8A909C]">
              Active au moins un type d&apos;événement : Matchs, Visites ou Relances.
            </div>
          ) : view === "list" ? (
            /* ── VUE LISTE — UNE liste chronologique (retour BP), les trois
               types mêlés par date et reconnus à leur couleur. Les filtres
               (sport, position…) ne portent que sur les matchs : une visite
               ou une relance n'est pas un match, la cacher parce qu'un filtre
               est posé ferait manquer un rendez-vous. */
            <div className="mt-[34px] flex flex-col gap-[30px]" data-testid="liste-chronologique">
              {actifs.m && matches.length === 0 && baseMatchCount > 0 && (
                <NoMatchForFilters minTargets={filters.minTargets} onReset={() => setFilters(EMPTY_FILTERS)} />
              )}
              {semaines.length === 0 ? (
                actifs.m && !actifs.v && !actifs.r && baseMatchCount === 0 ? <EmptyBoard /> : (
                  <p className="text-[14px] text-[#5C6575]">Rien à venir pour les types choisis.</p>
                )
              ) : semaines.map((w) => (
                <div key={w.cle} className="flex flex-col">
                  <div className="mb-3 flex items-baseline gap-3.5 border-b border-[#1E2129] pb-2">
                    <h3 className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#8A909C]">{w.label}</h3>
                    <span className="text-[12.5px] font-medium text-[#5C6575]">{pluriel(w.evenements.length, "événement")}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {w.evenements.map((e) => (
                      <div key={e.cle} data-jour={e.jour} data-type={e.type}>
                        {e.type === "m" ? <MatchCard m={e.m} /> : e.type === "v" ? <VisiteCard v={e.v} /> : <RelanceCard r={e.r} />}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── VUE MOIS — de courts libellés colorés dans la case du jour,
               un par type (« 2 matchs », « Visite », « Relance »). */
            <div className="mt-[34px]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[19px] font-bold capitalize">{monthLabel(cursor.year, cursor.month)}</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => shiftMonth(-1)}
                    disabled={atFirstMonth}
                    aria-label="Mois précédent"
                    className="h-[38px] w-[38px] rounded-full border border-[#262A33] bg-[#1A1D24] text-[16px] text-[#B9BFC9] transition-colors enabled:hover:border-[#333B4A] enabled:hover:text-[#EDEFF3] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftMonth(1)}
                    aria-label="Mois suivant"
                    className="h-[38px] w-[38px] rounded-full border border-[#262A33] bg-[#1A1D24] text-[16px] text-[#B9BFC9] transition-colors hover:border-[#333B4A] hover:text-[#EDEFF3]"
                  >
                    ›
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {DOW.map((d) => (
                  <div key={d} className="py-1.5 text-center text-[12px] font-bold uppercase tracking-[0.08em] text-[#5C6575]">
                    {d}
                  </div>
                ))}
                {grid.map((c) => {
                  const selected = selectedDay === c.iso;
                  const jour = parJour.get(c.iso);
                  const libelles: { cle: TypeEvenement; texte: string }[] = [];
                  if (jour && actifs.m && jour.matchs > 0) {
                    libelles.push({ cle: "m", texte: `${jour.hot ? "★ " : ""}${pluriel(jour.matchs, "match")}` });
                  }
                  if (jour && actifs.v && jour.visites > 0) {
                    libelles.push({ cle: "v", texte: jour.visites > 1 ? pluriel(jour.visites, "visite") : "Visite" });
                  }
                  if (jour && actifs.r && jour.relances > 0) {
                    libelles.push({ cle: "r", texte: jour.relances > 1 ? pluriel(jour.relances, "relance") : "Relance" });
                  }
                  return (
                    <button
                      key={c.iso}
                      type="button"
                      data-jour={c.iso}
                      onClick={() => setSelectedDay(selected ? null : c.iso)}
                      className={`flex min-h-[104px] flex-col items-stretch gap-1 rounded-xl border px-[9px] py-[8px] text-left text-[14px] font-semibold transition-colors ${
                        c.outside ? "opacity-[0.32]" : ""
                      } ${
                        selected
                          ? "border-[#333B4A] bg-[#20242C] text-[#EDEFF3]"
                          : c.isToday
                            ? "border-[#E63946] bg-[#1A1D24] text-[#EDEFF3]"
                            : "border-[#1E2129] bg-[#1A1D24] text-[#8A909C]"
                      }`}
                    >
                      <span>{c.day}</span>
                      {libelles.map((l) => (
                        <span
                          key={l.cle}
                          data-type-evenement={l.cle}
                          className="block truncate rounded-md px-1.5 py-[2px] text-[11.5px] font-bold leading-tight"
                          style={{ color: COULEUR[l.cle], backgroundColor: `${COULEUR[l.cle]}1F` }}
                        >
                          {l.texte}
                        </span>
                      ))}
                    </button>
                  );
                })}
              </div>

              {selectedDay ? (
                (actifs.m && dayMatches.length > 0) || (actifs.v && visitesDuJour.length > 0) || (actifs.r && relancesDuJour.length > 0) ? (
                  <div className="mt-4 flex flex-col gap-3">
                    {actifs.m && dayMatches.map((m) => <MatchCard key={m.game.id} m={m} />)}
                    {actifs.v && visitesDuJour.map((v) => <VisiteCard key={v.athleteId} v={v} />)}
                    {actifs.r && relancesDuJour.map((r) => <RelanceCard key={r.athleteId} r={r} />)}
                  </div>
                ) : (
                  <div className="mt-3.5 text-[13.5px] text-[#5C6575]">Rien ce jour-là pour ton unité.</div>
                )
              ) : (
                <div className="mt-3.5 text-[13.5px] text-[#5C6575]">
                  Sélectionnez un jour pour voir ses matchs, visites et relances.
                </div>
              )}
            </div>
          )}

        </>
      )}
    </div>
  );
}
