"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import AdvancedFilterDrawer from "./AdvancedFilterDrawer";
import {
  NEWSROOM_SORT_OPTIONS,
  DEFAULT_NEWSROOM_SORT,
  ORG_TYPE_OPTIONS,
  ORG_TYPE_PLACEHOLDER,
  COTE_MIN_OPTIONS,
  COTE_MIN_PLACEHOLDER,
} from "./partnerFilters";

/* ═══════════════════════════════════════════════════════════════
   NewsroomDropdownFilters — sport + position dropdowns that
   write to URL params, alongside the chip-based type/range
   filters already in /partenaire/newsroom. Same URL-driven
   pattern as ClassementsFilterBar.

   Position dropdown filters its own options by selected sport
   (positions are pre-fetched server-side and passed in).
═══════════════════════════════════════════════════════════════ */

interface SportOption { id: string; nom: string }
interface PositionOption { id: string; nom: string; abreviation: string | null; sport_id: string }

interface NewsroomDropdownFiltersProps {
  sports: SportOption[];
  positions: PositionOption[];
  regions: string[];
  graduationYears: number[];
}

export default function NewsroomDropdownFilters({
  sports,
  positions,
  regions,
  graduationYears,
}: NewsroomDropdownFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSport = searchParams.get("sport") || "";
  const currentPosition = searchParams.get("position") || "";
  const currentGenre = searchParams.get("genre") || "";
  const currentRegion = searchParams.get("region") || "";
  const currentYear = searchParams.get("year") || "";
  const currentOrg = searchParams.get("org") || "";
  const currentCote = searchParams.get("cote") || "";
  const currentSort = searchParams.get("sort") || DEFAULT_NEWSROOM_SORT;

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
    router.push(qs ? `/partenaire/newsroom?${qs}` : "/partenaire/newsroom");
  }

  const selectCls = "nx-filter-select bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] focus:border-[#E63946] outline-none transition-colors min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed";
  /* `.nx-filter-active` et non plus les utilitaires Tailwind : ceux-ci vivent
     dans un @layer de Tailwind v4, alors que `.nx-filter-select` est hors
     couche — le non-layered bat le layered, donc son fond et sa bordure
     écrasaient l'indicateur « filtre actif », qui devenait invisible. La
     classe partagée porte le même signal (bordure rouge, fond teinté, ET
     chevron rouge, que la version Tailwind n'avait pas). */
  const activeCls = "nx-filter-active";

  /* `type` et `range` sont pilotés par les chips de la PAGE, pas par ce
     composant — mais le bouton « Réinitialiser » les efface aussi (il repart
     de l'URL nue). Il doit donc apparaître dès qu'un filtre quelconque est
     posé, sinon on proposerait une remise à zéro qui ne se déclenche pas
     quand elle serait utile.
     `range` compte comme actif seulement s'il quitte son défaut de 30 jours,
     à l'identique du test `hasActiveFilters` de la page. */
  const currentType = searchParams.get("type") || "";
  const currentRange = searchParams.get("range") || "30d";
  const hasFilters =
    currentSport || currentPosition || currentGenre || currentOrg || currentCote
    || currentRegion || currentYear
    || currentType || currentRange !== "30d" || currentSort !== DEFAULT_NEWSROOM_SORT;

  return (
    <>
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
      {/* PROMOTION — `athletes.annee_diplomation` via l'embed. Comme le genre
          et la cote min, elle porte sur une colonne JOINTE : elle rejoint donc
          la condition qui déclenche `athletes!inner` côté page. */}
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

      {/* TRI — six options ici, cinq ailleurs. « Plus récent » est le défaut et
          correspond à l'ordre serveur (`occurred_at DESC`) : un fil d'actualité
          se lit du plus récent au plus ancien, et son filtre de période n'a de
          sens que sous cet ordre. Les 5 options communes sont présentes avec
          les mêmes libellés — c'est un sur-ensemble, pas une divergence. */}
      <select
        value={currentSort}
        onChange={(e) => pushFilter({ sort: e.target.value })}
        className={selectCls}
        aria-label="Trier"
      >
        {NEWSROOM_SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <div className="w-px h-6 bg-[#2D3748] mx-1 hidden sm:block" />

      <AdvancedFilterDrawer>
        {/* RÉGION — passe par `schools.region` accroché à l'ÉVÉNEMENT
            (`newsroom_events.school_id`, FK vers `schools`), pas par l'embed
            athlète. Deux raisons :
            1. un seul niveau de jointure — `athletes!inner(schools!inner(…))`
               est le patron le plus fragile de PostgREST ;
            2. cohérence avec le filtre Organisme, qui lit déjà le `school_id`
               de l'événement. La région est donc celle rattachée à
               l'événement, ce qui est le bon sens éditorial pour un fil
               d'actualité : un athlète qui change d'école plus tard ne
               réécrit pas la région de ses anciennes nouvelles. */}
        <select
          value={currentRegion}
          onChange={(e) => pushFilter({ region: e.target.value || null })}
          className={`${selectCls} ${currentRegion ? activeCls : ""}`}
          aria-label="Région"
        >
          <option value="">Toutes les régions</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        {/* ORGANISME — `newsroom_events` porte son PROPRE `school_id`
            (dénormalisé par le trigger, comme `sport_id`), avec une FK vers
            `schools`. Le test se fait donc directement sur l'événement, sans
            passer par l'embed athlète — un niveau de jointure en moins.
            Même réserve de données que sur les autres écrans : 0 athlète
            éligible en ligue civile au 19 août 2026. */}
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

        {/* COTE MIN — porte sur `athletes.cote_globale_entraineur` via l'embed,
            donc elle EXIGE `athletes!inner` (sinon PostgREST rendrait
            l'événement avec un embed vide au lieu de l'exclure). La page ajoute
            ce filtre à la condition qui déclenche l'inner. */}
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
          onClick={() => router.push("/partenaire/newsroom")}
          className="text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors px-2 shrink-0"
        >
          Réinitialiser
        </button>
      )}
    </>
  );
}
