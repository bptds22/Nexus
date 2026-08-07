"use client";

// components/shared/MaPageMobile.tsx
//
// « Ma page » sur mobile : un renvoi vers le web, et rien d'autre.
//
// Les deux éditeurs (page collège, page équipe) sont conçus pour un grand
// écran — topbar collante, aperçus en colonne, sections côte à côte. Les
// porter au tactile serait un chantier à part entière, pas une adaptation.
// D'ici là on le DIT plutôt que de servir un écran cassé.
//
// Motif repris de CoachEquipeDetailMobile (« Réactive-la sur le web. ») : une
// phrase dans la surface mobile, pas une redirection ni une route masquée.
// L'entrée reste visible dans « Plus » — la cacher laisserait croire que la
// fonction n'existe pas.

const card = "bg-[#1A1D24] border border-[#2D3748] rounded-xl";

export default function MaPageMobile() {
  return (
    <div
      className="px-4 nx-safe-top"
      style={{ paddingBottom: "calc(var(--tabzone, calc(env(safe-area-inset-bottom) + 88px)) + 12px)" }}
    >
      <header className="pt-2 pb-5">
        <h1 className="font-head text-[22px] font-black text-white uppercase tracking-tight">
          Ma page
        </h1>
      </header>

      <div className={`${card} px-5 py-6`}>
        <p className="text-[14px] text-[#E0E0E0] leading-relaxed">
          La page publique de ton établissement et celles de tes équipes se modifient
          <b className="text-white"> sur le web</b>, depuis un ordinateur.
        </p>
        <p className="text-[13px] text-[#9CA3AF] mt-3 leading-relaxed">
          L&apos;éditeur a besoin d&apos;un grand écran — aperçus, mise en page, sections côte à côte.
        </p>
      </div>
    </div>
  );
}
