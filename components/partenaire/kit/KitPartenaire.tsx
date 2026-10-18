/* ═══════════════════════════════════════════════════════════════
   Kit partagé du portail partenaire (P6, 1.4.5) — le rendu « premium »,
   même thème que le recruteur : fond navy, surfaces #1A1D24, accent rouge
   #E63946, titres Outfit en capitales. Une seule source pour les en-têtes,
   surfaces, boutons, pastilles, avis, états vides et chargement des trois
   onglets de la 1.4.5 (Recherche, Mes évaluations, Mes athlètes). Les autres
   pages partenaire l'adopteront au registre 1.4.6.

   Purement visuel : aucune donnée, aucun effet. Les boutons passent par
   classesBouton() pour servir aussi bien un <button> qu'un <Link>.
═══════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";

/** Le conteneur d'une page du portail (marges et largeur). */
export function classesPage(large = false): string {
  return `px-4 sm:px-8 py-6 sm:py-8 ${large ? "max-w-[1200px]" : "max-w-5xl"} mx-auto w-full`;
}

export function EnTetePartenaire({ titre, sousTitre, actions }: {
  titre: string;
  sousTitre?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4" data-entete-partenaire>
      <div className="min-w-0">
        <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#E63946]/80">Espace partenaire</p>
        <h1 className="font-head text-[26px] sm:text-[32px] leading-none mt-1.5 font-black text-white uppercase tracking-tight">{titre}</h1>
        {sousTitre && <div className="text-[13px] text-[#9CA3AF] mt-2 max-w-xl leading-relaxed">{sousTitre}</div>}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </header>
  );
}

/** Une surface (carte, encadré). `interactive` : bordure et halo rouges au survol. */
export function classesSurface(interactive = false): string {
  return `rounded-2xl border border-white/[0.07] bg-[#1A1D24] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]${
    interactive ? " transition-all duration-200 hover:border-[#E63946]/40 hover:shadow-[0_0_24px_rgba(230,57,70,0.10)]" : ""
  }`;
}

export type VarianteBouton = "principal" | "secondaire" | "discret" | "danger";

export function classesBouton(variante: VarianteBouton = "principal", petit = false): string {
  const taille = petit ? "min-h-[36px] px-3 py-1.5 text-[12px] rounded-lg" : "min-h-[44px] px-4 py-2.5 text-[13px] rounded-xl";
  const ton = {
    principal: "bg-[#E63946] hover:bg-[#D42B22] active:bg-[#C42E3A] text-white",
    secondaire: "border border-white/[0.10] bg-white/[0.02] text-white hover:bg-white/[0.06] hover:border-white/[0.18]",
    discret: "text-[#9CA3AF] hover:text-white",
    danger: "text-[#9CA3AF] hover:text-[#E63946]",
  }[variante];
  return `inline-flex items-center justify-center gap-1.5 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${taille} ${ton}`;
}

export type TonPastille = "neutre" | "succes" | "attention" | "accent";

export function Pastille({ ton = "neutre", children, ...data }: { ton?: TonPastille; children: ReactNode } & Record<`data-${string}`, string>) {
  const classes = {
    neutre: "bg-white/[0.06] text-[#c8c8cc] border-white/[0.10]",
    succes: "bg-[#22C55E]/12 text-[#4ADE80] border-[#22C55E]/30",
    attention: "bg-[#F59E0B]/12 text-[#FBBF24] border-[#F59E0B]/30",
    accent: "bg-[#E63946]/12 text-[#FF6B76] border-[#E63946]/35",
  }[ton];
  return (
    <span {...data} className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${classes}`}>
      {children}
    </span>
  );
}

export function Avis({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div role="status" className={`rounded-xl border px-4 py-3 text-[13px] ${ok ? "border-[#22C55E]/40 bg-[#22C55E]/10 text-[#86efac]" : "border-[#EF4444]/40 bg-[#EF4444]/10 text-[#fca5a5]"}`}>
      {children}
    </div>
  );
}

export function EtatVide({ titre, texte, action }: { titre: string; texte?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.10] bg-[#1A1D24]/50 px-6 py-10 text-center" data-etat-vide>
      <p className="text-[15px] font-bold text-white">{titre}</p>
      {texte && <div className="text-[13px] text-[#9CA3AF] mt-1.5 max-w-md mx-auto">{texte}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Chargement() {
  return (
    <div className="flex items-center justify-center py-24" aria-label="Chargement">
      <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
