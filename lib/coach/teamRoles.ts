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

/* ── DÉCISION PRODUIT (BP, 2026-09-10) — écrite, jamais héritée ──────
   L'ENTRAÎNEUR-CHEF PAR INTÉRIM A LES PLEINS POUVOIRS DU RESPONSABLE.

   Ce n'est pas une conséquence de la condition qu'on teste aujourd'hui,
   c'est un choix : le modèle a été bâti pour l'école secondaire, où un
   intérimaire tient l'équipe pour de vrai. L'index unique en base, cette
   liste, et la copie du bandeau intérim (« inviter d'autres entraîneurs —
   exactement comme un entraîneur-chef ») disent tous la même chose.

   TOUTE SURFACE QUI DÉCIDE D'UN DROIT DE RESPONSABLE passe par
   `isReferentRole()`. Jamais `role === "head_coach"` écrit à la main :
   une liste blanche vérifiée par énumération laisse passer ce qu'elle n'a
   pas nommé — c'est exactement ainsi qu'un intérimaire s'est retrouvé en
   lecture seule sur sa propre équipe (2026-09-10, écran équipe mobile).

   ⚠️ LA BASE N'EST PAS ENCORE ALIGNÉE. `is_team_head_coach()` teste
   `role = 'head_coach'` tout court, et garde les politiques INSERT/DELETE
   de `team_coaches`. Tant qu'elle n'est pas corrigée, un intérimaire peut
   CHANGER un rôle (branche école de la politique UPDATE) mais pas AJOUTER
   ni RETIRER un entraîneur — d'où les drapeaux `canAddStaff` / `canRemoveStaff`
   qui masque ces deux gestes plutôt que d'offrir des boutons qui échouent.
   Correction prévue au lot migration ; voir docs/fast-follow-1.4.2.md.
   ──────────────────────────────────────────────────────────────────── */

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
 * @param currentRole     rôle actuel de ce coach
 * @param teamCoachCount  nombre total de coachs sur l'équipe
 * @param teamHasReferent un AUTRE coach est-il déjà RESPONSABLE — head_coach
 *                        OU head_coach_interim.
 *
 * ⚠️ CORRECTION v2 (2026-09-09) : ce paramètre testait `head_coach` seul.
 * L'invariant que l'index unique protège porte sur les DEUX rôles
 * responsables. Avec un intérim en place, l'option intérim restait donc
 * ouverte : on pouvait prendre sa place EN SILENCE, alors que le même geste
 * face à un titulaire était bloqué et expliqué. Deux traitements pour un seul
 * invariant. La règle porte désormais sur isReferentRole.
 */
export function roleOptionsFor(
  currentRole: string,
  teamCoachCount: number,
  teamHasReferent: boolean,
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
          "Tu es le seul entraîneur — ajoute un autre entraîneur d'abord.",
      };
    }

    // RÈGLE 2 — un responsable est déjà en place (titulaire OU intérim) : on
    // n'en nomme pas un second (l'index unique le refuserait de toute façon,
    // mais l'UI doit l'expliquer AVANT l'échec).
    //
    // La promotion vers `head_coach` reste OUVERTE : c'est la passation
    // légitime, et setTeamCoachRole rétrograde le sortant dans l'ordre que
    // l'index impose. Ce qu'on ferme, c'est la nomination d'un SECOND
    // intérimaire — un intérim est un bouche-trou, pas un rôle qu'on double.
    if (teamHasReferent && value === "head_coach_interim") {
      return {
        value,
        label: ROLE_LABELS[value],
        disabled: true,
        reason: "Un responsable est déjà en place. Modifie d'abord son rôle.",
      };
    }

    return { value, label: ROLE_LABELS[value], disabled: false, reason: null };
  });
}
