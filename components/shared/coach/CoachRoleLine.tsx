"use client";

import TeamRoleSelect from "@/components/shared/coach/TeamRoleSelect";
import { roleLabel, roleColor, type TeamRole } from "@/lib/coach/teamRoles";

/* ═══════════════════════════════════════════════════════════════
   CoachRoleLine — le rôle d'un coach : un select, ou du texte.

   v3. Deux états, jamais les deux à la fois :

     · droits d'édition  → LE SELECT, seul. Il porte la couleur du rôle,
       donc il EST l'affichage — pas un contrôle posé à côté d'une
       pastille. C'est ce qui évite de retomber dans la redondance
       badge + dropdown de la v1, où deux éléments disaient la même
       chose côte à côte.

     · pas de droits → du TEXTE simple, dans la couleur du rôle. Pas de
       select grisé : un contrôle désactivé invite à cliquer et déçoit,
       là où un texte informe sans rien promettre.

   Les motifs de blocage vivent dans le `title` des options
   (`showReason={false}`) : une ligne de texte permanente sous chaque
   coach se répétait et poussait la mise en page.

   Composant unique web + mobile. Le PLACEMENT diffère — à droite de la
   ligne sur web, sous le nom sur mobile où la largeur manque — mais le
   rendu et les règles sont les mêmes.
   ═══════════════════════════════════════════════════════════════ */

export default function CoachRoleLine({
  role,
  canEdit,
  teamCoachCount,
  teamHasReferent,
  busy,
  variant = "web",
  onChange,
  className,
}: {
  role: string;
  /** false → texte simple, aucun contrôle. */
  canEdit: boolean;
  teamCoachCount: number;
  teamHasReferent: boolean;
  busy?: boolean;
  /** "mobile" → le select prend toute la largeur sous le nom. Le PLACEMENT
   *  diffère déjà entre les deux surfaces ; la largeur suit le placement. */
  variant?: "web" | "mobile";
  onChange: (next: TeamRole) => void;
  className?: string;
}) {
  if (!canEdit) {
    return (
      <span
        className={`text-[12px] font-semibold ${
          roleColor(role).split(" ").find((c) => c.startsWith("text-")) ?? "text-[#9CA3AF]"
        } ${className ?? ""}`}
      >
        {roleLabel(role)}
      </span>
    );
  }

  return (
    <TeamRoleSelect
      className={className}
      currentRole={role}
      teamCoachCount={teamCoachCount}
      teamHasReferent={teamHasReferent}
      disabled={busy}
      showReason={false}
      variant={variant}
      onChange={onChange}
    />
  );
}
