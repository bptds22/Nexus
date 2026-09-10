"use client";

import { roleOptionsFor, roleColor, type TeamRole } from "@/lib/coach/teamRoles";

/* ═══════════════════════════════════════════════════════════════
   TeamRoleSelect — le dropdown de rôle d'un coach sur une équipe.

   STYLE : celui des selects du design system (formulaire d'équipe —
   Division / Ligue / Saison) : fond sombre, bordure `white/[0.10]`,
   radius généreux, chevron dessiné, Outfit 600. Le `<select>` natif est
   conservé (accessibilité, comportement mobile) mais `appearance-none`
   lui retire le chevron du système, remplacé par le nôtre.

   Le TEXTE du select porte la COULEUR DU RÔLE : le select n'est pas un
   contrôle à côté d'une pastille, il EST l'affichage du rôle. C'est ce qui
   permet de supprimer la redondance badge + dropdown de la v1.

   COMPORTEMENT INCHANGÉ : les 4 options sont TOUJOURS visibles ; celles
   qui ne s'appliquent pas sont désactivées et portent leur motif. Cacher
   une option laisse croire qu'elle n'existe pas ; la désactiver avec sa
   raison apprend le modèle.

   Le motif vit en `title` sur l'option désactivée (survol). La ligne
   discrète sous le select est OPTIONNELLE (`showReason`) : utile quand le
   select est seul dans un formulaire, à couper quand il apparaît dans une
   liste — sinon le même motif se répète sous chaque coach et pousse la
   mise en page.

   LA COULEUR DU RÔLE VIT AUSSI SUR LA BORDURE (2026-09-10). Jusqu'ici seul
   le fragment `text-` de ROLE_COLORS était retenu, `bg-` et `border-` jetés :
   la doctrine « le select EST l'affichage du rôle » n'était donc appliquée
   qu'à moitié. Conséquence visible, un assistant en #9CA3AF sur boîte grise
   uniforme se lisait comme un contrôle DÉSACTIVÉ — exactement ce que la v3
   refusait en bannissant les selects grisés.

   `variant` — la seule chose qui diffère vraiment entre web et mobile :
   la LARGEUR. Sur web le select est aligné à droite d'une ligne, il se
   dimensionne à son contenu. Sur mobile il vit SOUS le nom, sur toute la
   largeur : à contenu variable, des largeurs variables donnaient un bord
   droit en dents de scie d'une ligne à l'autre. Une prop explicite plutôt
   qu'une surcharge de classes depuis l'appelant — même patron que le
   `variant` d'AthleteTransferSheet.
   ═══════════════════════════════════════════════════════════════ */

export default function TeamRoleSelect({
  currentRole,
  teamCoachCount,
  teamHasReferent,
  disabled,
  showReason = true,
  variant = "web",
  onChange,
  className,
}: {
  currentRole: string;
  teamCoachCount: number;
  teamHasReferent: boolean;
  disabled?: boolean;
  /** false → le motif ne vit QUE dans le tooltip de l'option. Utilisé par
   *  CoachRoleLine, où une ligne de texte permanente sous chaque coach
   *  poussait la mise en page et se répétait. */
  showReason?: boolean;
  /** "mobile" → pleine largeur. Voir l'en-tête. */
  variant?: "web" | "mobile";
  onChange: (next: TeamRole) => void;
  className?: string;
}) {
  const options = roleOptionsFor(currentRole, teamCoachCount, teamHasReferent);
  const bloquees = options.filter((o) => o.disabled && o.reason);
  // Un seul motif à l'écran : deux phrases pour deux options bloquées
  // noieraient l'information. Le reste vit dans les tooltips.
  const motif = bloquees.length > 0 ? bloquees[0].reason : null;

  const pleineLargeur = variant === "mobile";
  /* ROLE_COLORS livre trois fragments ; on en retient deux. Le `bg-` reste
     écarté à dessein : un fond teinté sur un contrôle le ferait passer pour
     une pastille, et la v1 est morte de cette confusion-là. */
  const teintes = roleColor(currentRole).split(" ");
  const teinteTexte = teintes.find((c) => c.startsWith("text-")) ?? "text-white";
  const teinteBordure = teintes.find((c) => c.startsWith("border-")) ?? "border-white/[0.10]";

  return (
    <div className={className}>
      <div className={`relative ${pleineLargeur ? "block w-full" : "inline-block"}`}>
        <select
          value={currentRole}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as TeamRole)}
          title={motif ?? undefined}
          aria-label="Rôle de cet entraîneur"
          /* `truncate` : garde-fou, jamais un choix de mise en page. À largeur
             automatique (web) il ne se déclenche jamais ; à largeur contrainte
             (mobile, ou police accessibilité agrandie) il coupe proprement
             « Entraîneur-chef par intérim » au lieu de le laisser déborder. */
          className={`appearance-none bg-[#1A1D24] border rounded-xl pl-3 pr-9 py-2 text-[13px] font-semibold outline-none focus:border-[#E63946]/40 disabled:opacity-50 cursor-pointer truncate ${
            pleineLargeur ? "w-full" : "max-w-full"
          } ${teinteTexte} ${teinteBordure}`}
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

      {showReason && motif && (
        <p className="text-[11.5px] text-[#6B7280] mt-1 truncate" title={motif}>
          {motif}
        </p>
      )}
    </div>
  );
}
