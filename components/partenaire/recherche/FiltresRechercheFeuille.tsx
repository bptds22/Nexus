"use client";

/* ═══════════════════════════════════════════════════════════════
   FiltresRechercheFeuille — la feuille « Filtres » de la Recherche du
   partenaire (P1, 1.4.5), sur LA feuille du recruteur
   (FilterBottomSheetShell : mêmes animations, même glissement, mêmes
   lignes). Chaque ligne ouvre un MobilePicker. Les filtres sont ceux que la
   recherche partenaire avait déjà : rien de plus, aucune donnée nouvelle.
═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { FilterBottomSheetShell, FilterRow, TogglePill } from "@/components/shared/filters/FilterBottomSheetShell";
import { MobilePicker, type PickerOption } from "@/components/mobile/MobilePicker";

export interface FiltresRecherche {
  sport: string;
  position: string;
  promotion: string;
  region: string;
  orgType: string;
  genre: string;
  minRating: string;
  withSportBadge: boolean;
  withVideoOnly: boolean;
  sortBy: string;
}

type Champ = "sport" | "position" | "promotion" | "region" | "orgType" | "genre" | "minRating" | "sortBy";

export const TRIS: PickerOption[] = [
  { value: "cote_desc", label: "Meilleure cote" },
  { value: "cote_asc", label: "Cote croissante" },
  { value: "grad_asc", label: "Graduation proche" },
  { value: "grad_desc", label: "Graduation éloignée" },
  { value: "name_asc", label: "Nom A-Z" },
];

export default function FiltresRechercheFeuille({
  open, onClose, onReset, resultCount, filtres, poser, sports, positions, regions, promotions,
}: {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  resultCount: number;
  filtres: FiltresRecherche;
  poser: (p: Partial<FiltresRecherche>) => void;
  sports: { id: string; nom: string }[];
  /** Positions DU SPORT choisi (vide sans sport). */
  positions: { id: string; nom: string; abreviation: string | null }[];
  regions: string[];
  promotions: number[];
}) {
  const [picker, setPicker] = useState<Champ | null>(null);

  const options: Record<Champ, { titre: string; liste: PickerOption[] }> = {
    sport: { titre: "Sport", liste: [{ value: "", label: "Tous les sports" }, ...sports.map((s) => ({ value: s.id, label: s.nom }))] },
    position: {
      titre: "Position",
      liste: [{ value: "", label: "Toutes les positions" }, ...positions.map((p) => ({ value: p.id, label: p.abreviation ? `${p.abreviation} — ${p.nom}` : p.nom }))],
    },
    promotion: { titre: "Promotion", liste: [{ value: "", label: "Toutes les promotions" }, ...promotions.map((p) => ({ value: String(p), label: String(p) }))] },
    region: { titre: "Région", liste: [{ value: "", label: "Toutes les régions" }, ...regions.map((r) => ({ value: r, label: r }))] },
    orgType: {
      titre: "Organisme",
      liste: [{ value: "", label: "Tous les organismes" }, { value: "scolaire", label: "École secondaire" }, { value: "ligue_civile", label: "Ligue civile" }],
    },
    genre: {
      titre: "Genre",
      liste: [{ value: "", label: "Tous les genres" }, { value: "M", label: "Masculin" }, { value: "F", label: "Féminin" }, { value: "X", label: "Non genré" }],
    },
    minRating: {
      titre: "Cote minimale",
      liste: [{ value: "", label: "Aucune" }, ...["3", "3.5", "4", "4.5"].map((v) => ({ value: v, label: `${v}+` }))],
    },
    sortBy: { titre: "Trier par", liste: TRIS },
  };
  const libelle = (c: Champ) => options[c].liste.find((o) => o.value === filtres[c])?.label ?? options[c].liste[0].label;

  return (
    <>
      <FilterBottomSheetShell open={open} onClose={onClose} onReset={onReset} resultCount={resultCount}>
        <div className="rounded-2xl bg-[#0C0E12] mx-4 mt-2 overflow-hidden" data-filtres-recherche-partenaire>
          <FilterRow label="Sport" value={libelle("sport")} onTap={() => setPicker("sport")} />
          <FilterRow label="Position" value={libelle("position")} onTap={() => setPicker("position")}
            disabled={!filtres.sport} disabledReason="Choisis un sport" />
          <FilterRow label="Promotion" value={libelle("promotion")} onTap={() => setPicker("promotion")} />
          <FilterRow label="Région" value={libelle("region")} onTap={() => setPicker("region")} />
          <FilterRow label="Organisme" value={libelle("orgType")} onTap={() => setPicker("orgType")} />
          <FilterRow label="Genre" value={libelle("genre")} onTap={() => setPicker("genre")} />
          <FilterRow label="Cote minimale" value={libelle("minRating")} onTap={() => setPicker("minRating")} />
          <FilterRow label="Trier par" value={libelle("sortBy")} onTap={() => setPicker("sortBy")} />
        </div>
        <div className="flex flex-wrap gap-2 px-4 pt-4 pb-2">
          <TogglePill active={filtres.withSportBadge} label="Distinction" onTap={() => poser({ withSportBadge: !filtres.withSportBadge })} />
          <TogglePill active={filtres.withVideoOnly} label="Avec vidéo" onTap={() => poser({ withVideoOnly: !filtres.withVideoOnly })} />
        </div>
      </FilterBottomSheetShell>
      {picker && (
        <MobilePicker
          open
          onClose={() => setPicker(null)}
          title={options[picker].titre}
          options={options[picker].liste}
          value={filtres[picker]}
          onChange={(v) => {
            const valeur = v == null ? "" : String(v);
            // Changer de sport efface la position (elle n'appartient plus au sport choisi).
            poser(picker === "sport" ? { sport: valeur, position: "" } : { [picker]: valeur } as Partial<FiltresRecherche>);
            setPicker(null);
          }}
        />
      )}
    </>
  );
}
