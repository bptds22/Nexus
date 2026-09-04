/* ═══════════════════════════════════════════════════════════════
   GradeChip / GradePicker — la puce de grade et son sélecteur (Lot 2)
   Partagés par le kanban web (page.tsx) et le mobile
   (RecruteurPipelineMobile.tsx) : une seule apparence à faire vivre.

   ── VIOLET = GRADE PRIVÉ RECRUTEUR ─────────────────────────────────────
   TEINTE RÉSERVÉE À CET USAGE SUR LES CARTES PIPELINE (arbitrage BP,
   2026-09-04). La réserve est PAR SURFACE, pas pour toute l'app : ailleurs
   `#8B5CF6` veut dire « groupe / diffusion » (GroupeCompose.tsx:28), et
   sert aussi de couleur de sport (Hockey) et de teinte de graphe. Ces
   écrans ne coexistent jamais avec une carte de pipeline.

   POURQUOI PAS UNE AUTRE. Relevé le 2026-09-04 : AUCUNE teinte saturée
   n'est libre à l'échelle de l'app. Ce qui compte est plus étroit et, lui,
   est vrai — sur page.tsx et RecruteurPipelineMobile.tsx, violet et indigo
   sont TOTALEMENT absents. La palette de ces deux fichiers est courte :
   #E63946 (plateforme/priorité), #F59E0B (cote/attention), #3B82F6
   (vérifié/complétion), #22C55E (ouvert), des gris. Le violet n'y entre en
   collision avec rien.

   COLLISION POTENTIELLE CONNUE — À SURVEILLER. La fiche athlète mobile
   (AthleteRecruiterProfileBodyMobile.tsx:559-561) colore ses stages en
   #6366F1 (contacté, indigo) et #A855F7 (visite planifiée, violet) — des
   VOISINS de notre teinte, sur un écran qu'on ouvre DEPUIS le pipeline.
   Si la puce et ces stages se confondent à l'usage, c'est LA FICHE qu'on
   ajuste, PAS la puce : la réserve du grade est posée en premier, et elle
   est explicite.

   LA GRADATION D'INTENSITÉ EST LE LANGAGE (arbitrage BP, 2026-09-04).
   Les 7 valeurs ne partagent plus une teinte unique : l'OPACITÉ du violet
   descend de A+ (opaque) à D (/15). La puce ne dit plus seulement « il y a
   un grade », elle dit LEQUEL, avant même qu'on lise la lettre. Détail de
   l'échelle et de la règle de bordure : voir GRADE_STYLES plus bas.

   UNE SEULE TEINTE, SEPT INTENSITÉS — jamais sept teintes. Pas de
   graduation chromatique (vert A+ → rouge D) : elle emprunterait le
   vocabulaire des statuts (vert = finalisé, rouge = plateforme) pour dire
   autre chose. L'opacité était la seule variable libre, elle porte tout.

   PAS DE GOLD, JAMAIS. Le gold appartient aux étoiles et aux signaux
   d'attention (la pilule de relance en retard, Lot 1). Une puce dorée
   dirait « urgent » là où elle ne dit que « voici mon jugement ».

   ── CALIBRAGE, RETOUR TERRAIN DU 2026-09-04 ────────────────────────────
   La première version (h-18px, texte 10px, fond white/10) était « hard to
   track » sur le kanban : trop petite et trop peu contrastée pour se
   repérer d'un balayage. La puce est passée au gabarit du NUMÉRO DE
   MAILLOT — même taille de texte (12px) et même graisse (font-black) que
   le `#3` de la carte — avec un fond deux fois plus dense et une bordure
   franche. Le texte est en blanc plein : aucune translucidité dessus, la
   lisibilité ne se négocie pas.

   Puis la neutralité grise a été levée au profit du violet, puis le violet
   uniforme au profit de la gradation ci-dessus — trois passes le même jour,
   chacune sur retour d'usage réel. La forme finale n'est pas un premier
   jet : c'est ce qui a survécu à trois regards.

   Outfit vient de la police par défaut de l'app (--font-sans), aucune
   classe de police à poser ici.
═══════════════════════════════════════════════════════════════ */

"use client";

import { GRADES, type Grade } from "@/lib/config/grades";

/* ── L'ÉCHELLE — LE LANGAGE VISUEL DU GRADE ─────────────────────────────
   Un seul map, consommé par la puce ET par le picker. L'intensité du fond
   DIT la force du grade : opaque en A+, presque effacé en D.

   LA BORDURE MONTE QUAND LE FOND DESCEND, et c'est délibérément l'inverse
   de la première intuition. Un fond fort n'a pas besoin d'être cerné ; un
   fond faible, si — sinon la puce D disparaît dans la carte. Mesuré sur
   le fond de carte #1A1D24 : une puce D (fond /15) ne détache que 1,17:1
   du fond, contre 1,66:1 avec sa bordure. C'est la bordure qui la rend
   repérable, pas son fond.

   EFFET DE BORD RECHERCHÉ : A+ est le SEUL cran dont la bordure a la même
   opacité que le fond — donc le seul qui se lit comme un bloc plein, sans
   contour. Tous les autres sont des puces cerclées. Le sommet de l'échelle
   se distingue par sa NATURE, pas seulement par son intensité, ce qui règle
   la discrimination A+ / A que deux crans d'opacité voisins rendraient
   fragile.

   Le texte reste blanc plein sur les 7 crans. Vérifié : même au cran le
   plus faible (D), le blanc tient 14,3:1 contre le fond composité — la
   lisibilité de la lettre n'est jamais le facteur limitant. */
const GRADE_STYLES: Record<Grade, string> = {
  "A+": "bg-[#8B5CF6]     border-[#8B5CF6]",
  "A":  "bg-[#8B5CF6]/70  border-[#8B5CF6]/80",
  "B+": "bg-[#8B5CF6]/55  border-[#8B5CF6]/70",
  "B":  "bg-[#8B5CF6]/45  border-[#8B5CF6]/65",
  "C+": "bg-[#8B5CF6]/35  border-[#8B5CF6]/60",
  "C":  "bg-[#8B5CF6]/25  border-[#8B5CF6]/55",
  "D":  "bg-[#8B5CF6]/15  border-[#8B5CF6]/50",
};

/** La puce sur une carte. Rend `null` sans grade : une carte non gradée ne
 *  porte pas de trou, elle ne porte rien. */
export function GradeChip({ grade, className = "" }: { grade?: Grade | null; className?: string }) {
  if (!grade) return null;
  return (
    <span
      title={`Ton grade : ${grade}`}
      className={`inline-flex items-center justify-center shrink-0 h-[22px] min-w-[30px] px-2 rounded-md border text-[12px] font-black leading-none tracking-tight text-white ${GRADE_STYLES[grade]} ${className}`}
    >
      {grade}
    </span>
  );
}

/* ── LE PICKER ──────────────────────────────────────────────────────────
   Grille de 7 + un geste « retirer le grade ». Retirer appelle onSelect(null),
   que useUpsertAthleteGrade traduit en DELETE : « pas de grade » se dit par
   l'absence de ligne, pas par un NULL.

   AUCUN SPINNER BLOQUANT. La mutation est optimiste — le cache est patché
   avant l'aller-retour, donc la sélection se déplace immédiatement. Un état
   « en cours » qui désactiverait la grille rendrait l'écran plus lent que la
   donnée, et un revert en onError repose de toute façon l'ancienne valeur.

   `compact={false}` (mobile) monte les cibles à 44px — le minimum tactile.

   LES 7 BOUTONS PORTENT LEUR PROPRE INTENSITÉ — le même GRADE_STYLES que la
   puce. La grille devient auto-explicative : on voit l'échelle en même temps
   qu'on choisit dedans, et le bouton qu'on presse a exactement l'apparence
   de la puce qu'il produira sur la carte.
   La SÉLECTION ne se marque donc PAS par un changement de fond — le fond est
   déjà pris, il porte le grade. Elle se marque par un anneau blanc, la seule
   variable encore libre. */
export function GradePicker({
  value,
  onSelect,
  compact = true,
}: {
  value?: Grade | null;
  onSelect: (grade: Grade | null) => void;
  compact?: boolean;
}) {
  const cell = compact ? "h-8 text-[12px]" : "h-11 text-[14px]";
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {GRADES.map((g) => {
          const active = value === g;
          return (
            <button
              key={g}
              type="button"
              onClick={() => onSelect(g)}
              aria-pressed={active}
              aria-label={`Grade ${g}`}
              className={`${cell} rounded-md border font-black leading-none tracking-tight text-white transition-all ${GRADE_STYLES[g]} ${
                active ? "ring-2 ring-white/80" : "opacity-70 hover:opacity-100"
              }`}
            >
              {g}
            </button>
          );
        })}
      </div>
      {/* Le retrait n'apparaît que s'il y a quelque chose à retirer. */}
      {value && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="mt-2 text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors"
        >
          Retirer le grade
        </button>
      )}
    </div>
  );
}
