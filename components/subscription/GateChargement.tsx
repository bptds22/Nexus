/* ═══════════════════════════════════════════════════════════════
   GateChargement — ce que FeatureGate et CegepGate affichent tant que
   le forfait n'est pas connu (useSubscription().loading).

   Ils rendaient `null` : la barre latérale restait, le contenu était vide,
   sans un mot. Un forfait lent à répondre (base locale, bascule du
   DevTierSwitcher, réseau mobile) se lisait comme une page cassée.

   Même rendu que le « Chargement du tableau de bord... » de Mon CÉGEP.
   Aucun enfant n'est monté pendant ce temps : la garantie du gate
   (pas de requête du contenu protégé avant la décision) est inchangée.
═══════════════════════════════════════════════════════════════ */

export default function GateChargement() {
  return (
    <div className="px-5 sm:px-8 py-8 max-w-[1400px] mx-auto" role="status" aria-live="polite">
      <p className="text-[#6b7280] text-sm">Chargement...</p>
    </div>
  );
}
