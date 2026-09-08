"use client";

import { useState } from "react";
import TeamRoleSelect from "@/components/shared/coach/TeamRoleSelect";
import { roleLabel, roleColor, type TeamRole } from "@/lib/coach/teamRoles";

/* ═══════════════════════════════════════════════════════════════
   CoachRoleLine — le rôle d'un coach, en sous-titre, éditable au crayon.

   AVANT (v1) : une pastille de rôle ET un dropdown permanent, côte à côte.
   Les deux disaient la même chose, et le dropdown ouvert en permanence
   transformait une information en formulaire. La ligne criait.

   MAINTENANT : le rôle est un SOUS-TITRE, dans la couleur du rôle. Le
   crayon n'apparaît que pour qui peut modifier ; le sélecteur ne s'ouvre
   qu'au clic. Consulter est le cas fréquent, modifier l'exception — c'est
   la consultation qui doit être calme.

   Le motif d'une option bloquée vit UNIQUEMENT dans le tooltip de
   l'option (`showReason={false}`) : plus de ligne de texte permanente
   sous la ligne, qui poussait la mise en page et se répétait à chaque
   coach.

   Composant unique web + mobile — les deux surfaces montent la même
   ligne, donc le layout ne peut pas diverger.
   ═══════════════════════════════════════════════════════════════ */

export default function CoachRoleLine({
  role,
  canEdit,
  teamCoachCount,
  teamHasReferent,
  busy,
  onChange,
}: {
  role: string;
  /** false → aucun crayon. Le rôle reste lisible, il n'est pas modifiable. */
  canEdit: boolean;
  teamCoachCount: number;
  teamHasReferent: boolean;
  busy?: boolean;
  onChange: (next: TeamRole) => void;
}) {
  const [ouvert, setOuvert] = useState(false);

  if (ouvert && canEdit) {
    return (
      <div className="flex items-center gap-2 mt-0.5">
        <TeamRoleSelect
          currentRole={role}
          teamCoachCount={teamCoachCount}
          teamHasReferent={teamHasReferent}
          disabled={busy}
          showReason={false}
          onChange={(next) => {
            setOuvert(false);
            onChange(next);
          }}
        />
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="text-[11px] font-bold text-[#6B7280] hover:text-white transition-colors"
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 mt-0.5">
      <span className={`text-[12px] font-semibold ${roleColor(role).split(" ").find((c) => c.startsWith("text-")) ?? "text-[#9CA3AF]"}`}>
        {roleLabel(role)}
      </span>

      {canEdit && (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          disabled={busy}
          title="Modifier le rôle"
          aria-label="Modifier le rôle"
          className="text-[#4a4d56] hover:text-[#E63946] transition-colors disabled:opacity-40"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
      )}
    </div>
  );
}
