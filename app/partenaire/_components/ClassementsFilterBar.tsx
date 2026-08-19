"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import AdvancedFilterDrawer from "./AdvancedFilterDrawer";
import {
  PARTNER_SORT_OPTIONS,
  DEFAULT_PARTNER_SORT,
  ORG_TYPE_OPTIONS,
  ORG_TYPE_PLACEHOLDER,
  COTE_MIN_OPTIONS,
  COTE_MIN_PLACEHOLDER,
} from "./partnerFilters";

/* ═══════════════════════════════════════════════════════════════
   ClassementsFilterBar — client-side filter dropdowns that
   write to URL params. The /partenaire/classements page reads
   the URL and re-queries top_athletes_view server-side.

   Position dropdown filters its own options by the selected
   sport (positions are pre-fetched server-side and passed
   in via the positionsBySport prop).
═══════════════════════════════════════════════════════════════ */

interface SportOption { id: string; nom: string }
interface PositionOption { id: string; nom: string; abreviation: string | null; sport_id: string }

interface ClassementsFilterBarProps {
  sports: SportOption[];
  positions: PositionOption[];
  regions: string[];
  graduationYears: number[];
}

export default function ClassementsFilterBar({
  sports,
  positions,
  regions,
  graduationYears,
}: ClassementsFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSport = searchParams.get("sport") || "";
  const currentPosition = searchParams.get("position") || "";
  const currentRegion = searchParams.get("region") || "";
  const currentYear = searchParams.get("year") || "";
  const currentGenre = searchParams.get("genre") || "";
  const currentOrg = searchParams.get("org") || "";
  const currentCote = searchParams.get("cote") || "";
  const currentSort = searchParams.get("sort") || DEFAULT_PARTNER_SORT;

  const positionsForSport = useMemo(
    () => (currentSport ? positions.filter((p) => p.sport_id === currentSport) : []),
    [currentSport, positions],
  );

  function pushFilter(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    router.push(qs ? `/partenaire/classements?${qs}` : "/partenaire/classements");
  }

  function reset() {
    router.push("/partenaire/classements");
  }

  /* Le tri compte comme un filtre actif dès qu'il quitte son défaut : sans ça,
     un utilisateur qui a changé l'ordre n'aurait aucun moyen de revenir à
     l'état initial, le bouton « Réinitialiser » restant caché. */
  const hasFilters =
    currentSport || currentPosition || currentRegion || currentYear || currentGenre
    || currentOrg || currentCote || currentSort !== DEFAULT_PARTNER_SORT;
  const selectCls = "nx-filter-select bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] focus:border-[#E63946] outline-none transition-colors min-w-[140px]";
  /* `.nx-filter-active` et non plus les utilitaires Tailwind : ceux-ci vivent
     dans un @layer de Tailwind v4, alors que `.nx-filter-select` est hors
     couche — le non-layered bat le layered, donc son fond et sa bordure
     écrasaient l'indicateur « filtre actif », qui devenait invisible. La
     classe partagée porte le même signal (bordure rouge, fond teinté, ET
     chevron rouge, que la version Tailwind n'avait pas). */
  const activeCls = "nx-filter-active";

  return (
    <div className="flex flex-wrap items-center gap-2 bg-[#1A1D24] border border-[#2D3748] rounded-xl p-3 sticky top-0 z-20">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] ml-1 mr-1">Filtres</span>

      <select
        value={currentSport}
        onChange={(e) => pushFilter({ sport: e.target.value || null, position: null })}
        className={`${selectCls} ${currentSport ? activeCls : ""}`}
        aria-label="Sport"
      >
        <option value="">Tous les sports</option>
        {sports.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
      </select>

      <select
        value={currentPosition}
        onChange={(e) => pushFilter({ position: e.target.value || null })}
        className={`${selectCls} ${currentPosition ? activeCls : ""}`}
        disabled={!currentSport}
        aria-label="Position"
      >
        <option value="">{currentSport ? "Toutes les positions" : "Sélectionner un sport d'abord"}</option>
        {positionsForSport.map((p) => (
          <option key={p.id} value={p.id}>
            {p.abreviation ? `${p.abreviation} — ${p.nom}` : p.nom}
          </option>
        ))}
      </select>

      <select
        value={currentYear}
        onChange={(e) => pushFilter({ year: e.target.value || null })}
        className={`${selectCls} ${currentYear ? activeCls : ""}`}
        aria-label="Promotion"
      >
        <option value="">Toutes les promotions</option>
        {graduationYears.map((y) => <option key={y} value={String(y)}>{y}</option>)}
      </select>

      <div className="w-px h-6 bg-[#2D3748] mx-1 hidden sm:block" />

      {/* TRI — l'ordre d'AFFICHAGE seulement. La composition du Top 25 reste
          définie par la cote, côté serveur : voir le commentaire de
          `sortPartnerRows` et celui de la page. */}
      <select
        value={currentSort}
        onChange={(e) => pushFilter({ sort: e.target.value })}
        className={selectCls}
        aria-label="Trier"
      >
        {PARTNER_SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <div className="w-px h-6 bg-[#2D3748] mx-1 hidden sm:block" />

      {/* Répartition primaires / avancés CALQUÉE sur /partenaire/athletes :
          sport, position, promotion et tri restent visibles ; région,
          organisme, genre et cote min passent dans le tiroir. Région et genre
          étaient inline ici avant le 2026-08-19 — ils descendent, pour que les
          quatre écrans présentent la même hiérarchie. */}
      <AdvancedFilterDrawer>
        <select
          value={currentRegion}
          onChange={(e) => pushFilter({ region: e.target.value || null })}
          className={`${selectCls} ${currentRegion ? activeCls : ""}`}
          aria-label="Région"
        >
          <option value="">Toutes les régions</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        {/* ORGANISME — dérivé de `school_id` : rattaché à une école, ou non.
            `top_athletes_view` projette la colonne, donc aucun DDL.
            ÉTAT DES DONNÉES AU 19 AOÛT 2026 : les 27 athlètes éligibles au
            portail sont TOUS scolaires. « Ligue civile » rendra un état vide
            et « École secondaire » ne retirera rien, tant qu'aucun athlète de
            club civil n'a activé sa visibilité partenaire. Le filtre est
            câblé et correct — c'est la donnée qui manque. */}
        <select
          value={currentOrg}
          onChange={(e) => pushFilter({ org: e.target.value || null })}
          className={`${selectCls} ${currentOrg ? activeCls : ""}`}
          aria-label="Organisme"
        >
          <option value="">{ORG_TYPE_PLACEHOLDER}</option>
          {ORG_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* GENRE — `athletes.genre` est brut en base ('M' | 'F' | 'X' | NULL).
            On normalise ICI, à l'affichage, jamais en base : la colonne est
            écrite par quatre formulaires, et traduire côté vue créerait un
            second vocabulaire à maintenir.
            Un athlète sans genre SORT des résultats dès qu'un genre est choisi —
            le champ n'est obligatoire qu'en mode « détaillé » à la création,
            donc 12 profils sur 26 sont à NULL. Choix assumé : un partenaire qui
            filtre fait une sélection éditoriale ; y verser des profils dont le
            critère n'est pas établi serait pire qu'une omission. Sans filtre,
            ils restent tous visibles.

            ÉTAT DES DONNÉES AU 17 AOÛT 2026 : aucune ligne 'F' ni 'X' n'existe
            en base. 26 athlètes — 14 en 'M', 12 à NULL. Les options Féminin et
            Non genré sont câblées et fonctionnelles, mais rendront un état vide
            tant qu'aucune athlète féminine n'est saisie. CE N'EST PAS UN BUG DU
            FILTRE, et il ne faut pas « corriger » en dérivant la liste d'options
            des valeurs présentes : le filtre doit rester complet pour être prêt
            le jour où la donnée arrive, et une liste qui rétrécit avec le jeu de
            données rend le portail imprévisible. */}
        <select
          value={currentGenre}
          onChange={(e) => pushFilter({ genre: e.target.value || null })}
          className={`${selectCls} ${currentGenre ? activeCls : ""}`}
          aria-label="Genre"
        >
          <option value="">Tous les genres</option>
          <option value="M">Masculin</option>
          <option value="F">Féminin</option>
          <option value="X">Non genré</option>
        </select>

        {/* COTE MIN — ÉTAT DES DONNÉES AU 19 AOÛT 2026 : 2 athlètes cotés sur
            27 (5.00 et 3.50). « 3+ » et « 3.5+ » rendent donc le même couple,
            « 4+ » et « 4.5+ » le même singleton. Le filtre discrimine, mais
            fait tomber l'écran de 27 lignes à 2 ou 1. */}
        <select
          value={currentCote}
          onChange={(e) => pushFilter({ cote: e.target.value || null })}
          className={`${selectCls} ${currentCote ? activeCls : ""}`}
          aria-label="Cote minimale"
        >
          <option value="">{COTE_MIN_PLACEHOLDER}</option>
          {COTE_MIN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </AdvancedFilterDrawer>

      {hasFilters && (
        <button
          type="button"
          onClick={reset}
          className="text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors ml-1 px-2"
        >
          Réinitialiser
        </button>
      )}
    </div>
  );
}
