"use client";

import { roleOptionsFor, type TeamRole } from "@/lib/coach/teamRoles";

/* ═══════════════════════════════════════════════════════════════
   TeamRoleSelect — le dropdown de rôle d'un coach sur une équipe.

   RÈGLE MAISON : les options sont TOUJOURS VISIBLES, jamais masquées.
   Une option retirée laisse croire qu'elle n'existe pas ; une option
   désactivée avec son motif apprend le modèle. Les deux motifs viennent
   de `roleOptionsFor` (lib/coach/teamRoles) — la règle est écrite une
   fois, testable seule, et rendue identiquement web et mobile.

   Le `title` porte le motif en tooltip natif ; il est aussi rendu sous le
   select quand une option est bloquée, parce qu'un tooltip natif n'existe
   pas au toucher (mobile).
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
  // Un seul motif suffit à l'écran : afficher deux phrases pour deux options
  // bloquées noierait l'information. On montre le premier.
  const motif = bloquees.length > 0 ? bloquees[0].reason : null;

  return (
    <div className={className}>
      <select
        value={currentRole}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as TeamRole)}
        title={motif ?? undefined}
        aria-label="Rôle de cet entraîneur"
        className="bg-[#13151a] border border-[#2a2d36] rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#D1D5DB] focus:outline-none focus:border-[#E63946]/50 disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled} title={o.reason ?? undefined}>
            {o.label}
          </option>
        ))}
      </select>

      {motif && (
        <p className="text-[11px] text-[#6b7280] mt-1 max-w-[280px] leading-snug">{motif}</p>
      )}
    </div>
  );
}
