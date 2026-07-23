/* ═══════════════════════════════════════════════════════════════
   AthleteSectionHeader — section label for the coach "Mes athlètes"
   roster when a DIRECTOR sees two sections ("Mes athlètes" +
   "Athlètes de l'école"). Shared by web (app/coach/athletes/page)
   and mobile (CoachAthletesMobile) so the section language + the
   "Directeur" badge stay identical across platforms.

   Mirrors the teams-page precedent (app/coach/equipes/page.tsx
   L318-320 / L366-371): same H2 typography, same blue "Directeur"
   pill on the school-oversight section. The blue #3B82F6 here is on
   a SECTION HEADER (not an athlete/team card), consistent with the
   teams page — it is not a verification signal.
═══════════════════════════════════════════════════════════════ */

export function AthleteSectionHeader({
  title,
  count,
  director = false,
}: {
  title: string;
  count: number;
  director?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="font-head text-[13px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF]">
        {title}
      </h2>
      {director && (
        <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30">
          Directeur
        </span>
      )}
      <span className="text-[12px] font-bold text-[#6b7280]">{count}</span>
    </div>
  );
}
