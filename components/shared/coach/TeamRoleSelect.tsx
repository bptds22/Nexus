"use client";

import { roleOptionsFor, type TeamRole } from "@/lib/coach/teamRoles";

/* ═══════════════════════════════════════════════════════════════
   TeamRoleSelect — le dropdown de rôle d'un coach sur une équipe.

   STYLE : celui des selects du design system (formulaire d'équipe —
   Division / Ligue / Saison) : fond sombre, bordure `white/[0.10]`,
   radius généreux, chevron dessiné, Outfit 600. Le `<select>` natif est
   conservé (accessibilité, comportement mobile) mais `appearance-none`
   lui retire le chevron du système, remplacé par le nôtre.

   COMPORTEMENT INCHANGÉ : les 4 options sont TOUJOURS visibles ; celles
   qui ne s'appliquent pas sont désactivées et portent leur motif. Cacher
   une option laisse croire qu'elle n'existe pas ; la désactiver avec sa
   raison apprend le modèle.

   Le motif apparaît à deux endroits, pour deux publics : en `title` sur
   l'option désactivée (survol, desktop) et en UNE ligne discrète sous le
   select (toucher, mobile — où aucun tooltip natif n'existe).
   ═══════════════════════════════════════════════════════════════ */

export default function TeamRoleSelect({
  currentRole,
  teamCoachCount,
  teamHasHeadCoach,
  disabled,
  onChange,
  className,
}: {
  currentRole: string;
  teamCoachCount: number;
  teamHasHeadCoach: boolean;
  disabled?: boolean;
  onChange: (next: TeamRole) => void;
  className?: string;
}) {
  const options = roleOptionsFor(currentRole, teamCoachCount, teamHasHeadCoach);
  const bloquees = options.filter((o) => o.disabled && o.reason);
  // Un seul motif à l'écran : deux phrases pour deux options bloquées
  // noieraient l'information. Le reste vit dans les tooltips.
  const motif = bloquees.length > 0 ? bloquees[0].reason : null;

  return (
    <div className={className}>
      <div className="relative inline-block">
        <select
          value={currentRole}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as TeamRole)}
          title={motif ?? undefined}
          aria-label="Rôle de cet entraîneur"
          className="appearance-none bg-[#1A1D24] border border-white/[0.10] rounded-xl pl-3 pr-9 py-2 text-[13px] font-semibold text-white outline-none focus:border-[#E63946]/40 disabled:opacity-50 cursor-pointer"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled} title={o.reason ?? undefined}>
              {o.label}
            </option>
          ))}
        </select>

        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {motif && (
        <p className="text-[11.5px] text-[#6B7280] mt-1 truncate" title={motif}>
          {motif}
        </p>
      )}
    </div>
  );
}
