"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════
   TendancesDropdownFilters — sport, position, région, promotion
   et genre, écrits dans les params d'URL de /partenaire/tendances.
   Mirrors NewsroomDropdownFilters (same cascading sport→position
   UX, same disabled-with-placeholder treatment, same Tailwind
   classes) — just routes back to /partenaire/tendances on
   change.

   Position dropdown filters its own options by selected sport
   (positions are pre-fetched server-side and passed in).

   RÉGION ET PROMOTION (19 août 2026) — `trending_athletes_view`
   projetait DÉJÀ `region` et `annee_diplomation` ; il ne manquait
   que l'UI. Aucun DDL, donc aucune collision avec le chantier RLS
   partenaire qui va redéfinir cette vue.
   L'ordre des selects et le vocabulaire des params (`region`,
   `year`) reproduisent ClassementsFilterBar : les deux écrans
   pilotés par l'URL partagent la même grammaire, une URL se relit
   d'un écran à l'autre.
═══════════════════════════════════════════════════════════════ */

interface SportOption { id: string; nom: string }
interface PositionOption { id: string; nom: string; abreviation: string | null; sport_id: string }

interface TendancesDropdownFiltersProps {
  sports: SportOption[];
  positions: PositionOption[];
  regions: string[];
  graduationYears: number[];
}

export default function TendancesDropdownFilters({
  sports,
  positions,
  regions,
  graduationYears,
}: TendancesDropdownFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSport = searchParams.get("sport") || "";
  const currentPosition = searchParams.get("position") || "";
  const currentRegion = searchParams.get("region") || "";
  const currentYear = searchParams.get("year") || "";
  const currentGenre = searchParams.get("genre") || "";

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
    router.push(qs ? `/partenaire/tendances?${qs}` : "/partenaire/tendances");
  }

  const selectCls = "nx-filter-select bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] focus:border-[#E63946] outline-none transition-colors min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed";
  /* `.nx-filter-active` et non plus les utilitaires Tailwind : ceux-ci vivent
     dans un @layer de Tailwind v4, alors que `.nx-filter-select` est hors
     couche — le non-layered bat le layered, donc son fond et sa bordure
     écrasaient l'indicateur « filtre actif », qui devenait invisible. La
     classe partagée porte le même signal (bordure rouge, fond teinté, ET
     chevron rouge, que la version Tailwind n'avait pas). */
  const activeCls = "nx-filter-active";

  /* Région et promotion DOIVENT figurer ici — c'est ce test qui pilote
     l'affichage du bouton « Réinitialiser ». Son pendant serveur,
     `hasActiveFilters` dans page.tsx, choisit lequel des deux états vides
     s'affiche : sans ces deux clés, filtrer une région sans tendance
     annoncerait « Aucune tendance détectée cette semaine » — un constat sur
     la semaine, alors que la cause est le filtre. */
  const hasFilters = currentSport || currentPosition || currentRegion || currentYear || currentGenre;

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

      {/* RÉGION — `trending_athletes_view` projette `region` depuis l'origine
          (elle vient de `schools.region` via la LEFT JOIN de la vue). La liste
          d'options est dérivée de `schools`, PAS des athlètes affichés : une
          liste qui rétrécit avec le jeu de données rend le portail
          imprévisible, même raisonnement que pour le genre. */}
      <select
        value={currentRegion}
        onChange={(e) => pushFilter({ region: e.target.value || null })}
        className={`${selectCls} ${currentRegion ? activeCls : ""}`}
        aria-label="Région"
      >
        <option value="">Toutes les régions</option>
        {regions.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>

      {/* PROMOTION — `annee_diplomation`, projetée par la vue. Les années sont
          une constante partagée avec /classements et /athletes, pas une
          requête : elles ne dépendent pas des données présentes. */}
      <select
        value={currentYear}
        onChange={(e) => pushFilter({ year: e.target.value || null })}
        className={`${selectCls} ${currentYear ? activeCls : ""}`}
        aria-label="Promotion"
      >
        <option value="">Toutes les promotions</option>
        {graduationYears.map((y) => <option key={y} value={String(y)}>{y}</option>)}
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

      {hasFilters && (
        <button
          type="button"
          onClick={() => router.push("/partenaire/tendances")}
          className="text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors px-2"
        >
          Réinitialiser
        </button>
      )}
    </>
  );
}
