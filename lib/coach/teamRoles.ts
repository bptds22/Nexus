/* ═══════════════════════════════════════════════════════════════
   teamRoles — LE vocabulaire des rôles d'équipe, côté client.

   Miroir exact de la contrainte SQL posée par la vague 1
   (migration 20260908173945) :

     team_coaches_role_check
       CHECK (role IN ('head_coach','head_coach_interim','assistant','coordinator'))

   et de l'index unique partiel qui garantit AU PLUS UN responsable :

     team_coaches_one_referent_per_team
       UNIQUE (team_id) WHERE role IN ('head_coach','head_coach_interim')

   CONTRAT : toute surface qui affiche, propose ou écrit un rôle d'équipe
   passe par ce module. Le libellé, la couleur et la notion de « responsable »
   étaient jusqu'ici dupliqués dans app/coach/equipes/page.tsx et dans
   app/coach/equipes/[teamId]/PageClient.tsx — deux copies qui ont divergé au
   premier rôle ajouté (head_coach_interim s'affichait en slug brut).

   ⚠️ « AU PLUS UN » vs « EXACTEMENT UN » : le SQL ne garantit que le premier.
   Une équipe peut légitimement n'avoir aucun responsable (départ de
   l'entraîneur-chef, aucune auto-promotion — décision produit). Les surfaces
   doivent traiter ce cas, pas le supposer impossible.

   VOCABULAIRE À L'ÉCRAN : « entraîneur-chef », jamais « head coach ». Le
   terme technique reste la valeur en base (head_coach / head_coach_interim) ;
   seul l'affichage est en français. Ce module est le seul endroit où les deux
   se rencontrent.
   ═══════════════════════════════════════════════════════════════ */

/** Les 4 valeurs acceptées par la contrainte SQL. Rien d'autre n'est valide. */
export const TEAM_ROLES = [
  "head_coach",
  "head_coach_interim",
  "assistant",
  "coordinator",
] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

/** Les rôles qui font de leur porteur LE responsable de l'équipe.
 *  Même liste que la clause WHERE de l'index unique partiel. */
export const REFERENT_ROLES = ["head_coach", "head_coach_interim"] as const;

export function isReferentRole(role: string | null | undefined): boolean {
  return role === "head_coach" || role === "head_coach_interim";
}

export const ROLE_LABELS: Record<string, string> = {
  head_coach: "Entraîneur-chef",
  head_coach_interim: "Entraîneur-chef par intérim",
  assistant: "Assistant",
  coordinator: "Coordonnateur",
};

export const ROLE_COLORS: Record<string, string> = {
  head_coach: "bg-[#E63946]/15 text-[#E63946] border-[#E63946]/30",
  head_coach_interim: "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30",
  assistant: "bg-[#2D3748] text-[#9CA3AF] border-[#2D3748]",
  coordinator: "bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30",
};

/** Libellé d'un rôle, avec repli sur la valeur brute — un rôle inconnu doit
 *  rester lisible plutôt que disparaître. */
export function roleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role] ?? role;
}

export function roleColor(role: string | null | undefined): string {
  return (role && ROLE_COLORS[role]) || ROLE_COLORS.assistant;
}

/** Nom affichable d'un coach. Repli « Coach » : deux comptes de team_coaches
 *  ont first_name/last_name vides en prod (2026-09-09), et l'un d'eux est
 *  responsable — un dropdown ne doit pas proposer une ligne sans étiquette. */
export function coachDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const n = `${firstName ?? ""} ${lastName ?? ""}`.replace(/\s+/g, " ").trim();
  return n || "Coach";
}

/* ── Règles de blocage du dropdown de rôle (Lot D) ─────────────────
   Options TOUJOURS visibles, jamais masquées — désactivées avec une raison.
   Règle maison : cacher une option, c'est laisser l'utilisateur croire
   qu'elle n'existe pas ; la désactiver avec un motif, c'est lui apprendre
   le modèle.                                                              */

export interface RoleOptionState {
  value: TeamRole;
  label: string;
  disabled: boolean;
  /** Motif du blocage, rendu en tooltip. null quand l'option est ouverte. */
  reason: string | null;
}

/**
 * État des 4 options pour UN coach donné, dans le contexte de son équipe.
 *
 * @param currentRole      rôle actuel de ce coach
 * @param teamCoachCount   nombre total de coachs sur l'équipe
 * @param teamHasHeadCoach l'équipe a-t-elle un head_coach TITULAIRE
 *                         (head_coach, pas intérim) — sur un AUTRE coach
 */
export function roleOptionsFor(
  currentRole: string,
  teamCoachCount: number,
  teamHasHeadCoach: boolean,
): RoleOptionState[] {
  const seul = teamCoachCount <= 1;

  return TEAM_ROLES.map((value) => {
    // Le rôle courant reste toujours sélectionnable : c'est la valeur affichée.
    if (value === currentRole) {
      return { value, label: ROLE_LABELS[value], disabled: false, reason: null };
    }

    // RÈGLE 1 — coach seul sur l'équipe : il EST le responsable, il ne peut
    // pas se dégrader sans laisser l'équipe sans personne.
    if (seul && !isReferentRole(value)) {
      return {
        value,
        label: ROLE_LABELS[value],
        disabled: true,
        reason:
          "Tu es le seul entraîneur — ajoute un autre entraîneur pour pouvoir céder la responsabilité.",
      };
    }

    // RÈGLE 2 — un head coach titulaire existe déjà : on ne nomme pas un
    // intérimaire à côté de lui (l'index unique le refuserait de toute façon,
    // mais l'UI doit l'expliquer AVANT l'échec).
    if (teamHasHeadCoach && value === "head_coach_interim") {
      return {
        value,
        label: ROLE_LABELS[value],
        disabled: true,
        reason: "Un entraîneur-chef existe déjà. Modifie d'abord son rôle.",
      };
    }

    return { value, label: ROLE_LABELS[value], disabled: false, reason: null };
  });
}
