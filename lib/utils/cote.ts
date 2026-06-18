/* ═══════════════════════════════════════════════════════════════
   cote.ts — neutral utility for the coach cote-change confirmation
   modal. Sits in lib/utils/ (not in saveAthlete.ts) so :

     1. The wizard surfaces (Cote-A : app/coach/athletes/[id]/modifier,
        app/coach/athletes/create, components/shared/AthleteWizardMobile)
        which already import from saveAthlete.ts can ALSO import this
        helper.

     2. The quick-eval mobile sheet (Cote-B : CoachATraiterMobile) which
        does NOT go through saveAthlete.ts can import the SAME helper
        without coupling its data-layer to the wizard's. Decoupled
        location = no spurious wizard ⇄ atraiter dependency.

   coteChanged() : the gate predicate. Returns true for ANY meaningful
   change : null↔value transitions (first-time eval, clearing) AND
   significant numeric change. The epsilon handles parseFloat(toFixed(2))
   rounding noise from computeCoteGlobale's trait-average. For integer
   stars from the quick-eval sheet the epsilon is irrelevant — strict
   inequality flows through.
═══════════════════════════════════════════════════════════════ */

const COTE_EPS = 0.005;

export function coteChanged(a: number | null, b: number | null): boolean {
  if ((a == null) !== (b == null)) return true;
  if (a == null && b == null) return false;
  return Math.abs((a as number) - (b as number)) > COTE_EPS;
}
