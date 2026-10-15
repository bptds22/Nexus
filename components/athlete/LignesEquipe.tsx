/* LignesEquipe — les deux lignes sous le nom d'une équipe RÉSOLUE (code
   d'adhésion, transfert, verrou de code à l'inscription). Le texte vient de
   lignesEquipeResolue (lib/teams/teamLabel, décision BP 2026-10-15) :
     - essentiel, en évidence : Catégorie · Division · Genre ;
     - contexte, discret      : Club · Sport · Saison (+ Ligue si ≠ club).
   Une ligne vide n'est pas rendue. */

export default function LignesEquipe({ essentiel, contexte, className = "" }: {
  essentiel: string;
  contexte: string;
  className?: string;
}) {
  if (!essentiel && !contexte) return null;
  return (
    <div className={className}>
      {essentiel ? <div className="truncate text-[13px] font-semibold text-white/85">{essentiel}</div> : null}
      {contexte ? <div className="truncate text-[12px] text-[#9CA3AF]">{contexte}</div> : null}
    </div>
  );
}
