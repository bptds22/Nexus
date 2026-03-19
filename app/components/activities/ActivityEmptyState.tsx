import Link from "next/link";

/* ─────────────────────────────────────────────────────────────────
   ActivityEmptyState — shown when no activities match the filter.
───────────────────────────────────────────────────────────────── */

interface Props {
  portal: "coach" | "recruiter";
}

export default function ActivityEmptyState({ portal }: Props) {
  const cta = portal === "coach"
    ? { label: "Voir mes athlètes", href: "/coach/athletes" }
    : { label: "Rechercher des athlètes", href: "/recruteur/recherche" };

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-[#1A1D24] border border-white/5 flex items-center justify-center mb-6">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      </div>
      <h3 className="font-head text-xl font-black text-white uppercase tracking-wide mb-2">
        Aucune activité
      </h3>
      <p className="text-[14px] text-[#9CA3AF] max-w-md mb-6 leading-relaxed">
        {portal === "coach"
          ? "Quand des recruteurs consulteront vos athlètes ou vous enverront des messages, l'activité apparaîtra ici."
          : "Quand vous interagirez avec des profils d'athlètes ou recevrez des réponses, l'activité apparaîtra ici."}
      </p>
      <Link
        href={cta.href}
        className="flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-6 py-3 font-head font-bold text-[13px] uppercase tracking-widest transition-all hover:bg-[#c62d3a] hover:-translate-y-0.5 active:scale-95"
      >
        {cta.label}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M5 12h14" />
          <path d="M12 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
