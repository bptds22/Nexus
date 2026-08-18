"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

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
}

export default function NewsroomDropdownFilters({ sports, positions }: NewsroomDropdownFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSport = searchParams.get("sport") || "";
  const currentPosition = searchParams.get("position") || "";
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

    </>
  );
}
