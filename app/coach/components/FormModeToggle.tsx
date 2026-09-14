/* ─────────────────────────────────────────────────────────────────
   FormModeToggle — « Cote rapide » / « Évaluation complète »

   Ne sert PLUS qu'à l'ÉVALUATION (BP, 2026-09-09) : les cinq autres modes
   de saisie sont partis, tous leurs champs sont révélés. Celui-ci reste
   parce que la cote rapide reste — une étoile, sans remplir 14 critères.

   Le mot « Simplifié » ne dit pas ce que fait le bouton : il suggère un
   produit au rabais. « Cote rapide » dit le geste.
───────────────────────────────────────────────────────────────── */

interface FormModeToggleProps {
  mode: "simple" | "detailed";
  onChange: (mode: "simple" | "detailed") => void;
}

export default function FormModeToggle({ mode, onChange }: FormModeToggleProps) {
  const isDetailed = mode === "detailed";
  const pillCls = (active: boolean) =>
    `px-4 py-2 rounded-md text-[12px] font-bold uppercase tracking-[0.1em] transition-all ${
      active
        ? "bg-[#E63946] text-white shadow-[0_0_8px_rgba(230,57,70,0.2)]"
        : "text-[#6b7280] hover:text-white"
    }`;

  return (
    <div className="flex items-center gap-1 bg-[#13151a] rounded-lg p-1 mb-8 w-fit">
      <button type="button" onClick={() => onChange("simple")} className={pillCls(!isDetailed)}>
        Cote rapide
      </button>
      <button type="button" onClick={() => onChange("detailed")} className={pillCls(isDetailed)}>
        Évaluation complète
      </button>
    </div>
  );
}
