"use client";

/* ── RelancesDuJour ───────────────────────────────────────────────
   Le compte des relances dues, et les premières nommées.

   PARTAGÉ WEB + MOBILE depuis l'alignement de parité 1.4.1. Il est né dans
   `RecruteurDashboardMobile` et y est resté un temps : le tronc partagé
   (`usePipelineCards`, `sortPipelineCards`) était passé des deux côtés, pas
   l'encart. Les deux dashboards le montent désormais depuis ici, au même
   endroit relatif — juste au-dessus du funnel « Mon processus ».

   AUCUNE REQUÊTE NOUVELLE : `usePipelineCards` charge déjà toutes les cartes
   du recruteur avec `next_action_at`, le nom et la photo. Le badge se dérive
   du même cache TanStack que « Mon processus » — pas d'aller-retour en plus,
   pas de surface RLS en plus, et les deux écrans ne peuvent pas diverger.

   `next_action_at` est une DATE en base, pas un timestamp : « aujourd'hui »
   est le même jour pour tout le monde et il n'y a aucun fuseau à arbitrer.
   On compare donc sur la chaîne AAAA-MM-JJ locale, sans passer par
   `new Date()` qui réinterpréterait la date en UTC et décalerait d'un jour
   les usagers à l'ouest de Greenwich.

   EN RETARD ET AUJOURD'HUI SONT DISTINGUÉS, jamais fondus : « 3 relances »
   dont deux datent de la semaine dernière ne dit pas la même chose que trois
   relances du jour. Le retard passe en tête et se voit.

   Le palier se garde CHEZ L'APPELANT, pas ici : la relance est une fonction
   Pro de bout en bout, et le dashboard doit pouvoir passer `enabled: false`
   au hook pour qu'un Free ne charge même pas le pipeline. Un encart qui
   compterait des relances qu'un Free ne peut pas planifier serait une
   vitrine, pas un outil.
─────────────────────────────────────────────────────────────────── */

export interface RelanceCard {
  id?: string;
  full_name?: string;
  next_action_at?: string | null;
}

export function RelancesDuJour({ cards, onTapAthlete, onTapToutVoir }: {
  cards: RelanceCard[];
  onTapAthlete: (id: string | undefined) => void;
  onTapToutVoir: () => void;
}) {
  const aujourdhui = new Date();
  const cle = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, "0")}-${String(aujourdhui.getDate()).padStart(2, "0")}`;

  const dues = cards
    .filter((c) => !!c.next_action_at && (c.next_action_at as string).slice(0, 10) <= cle)
    .sort((a, b) => (a.next_action_at as string).slice(0, 10).localeCompare((b.next_action_at as string).slice(0, 10)));

  if (dues.length === 0) return null;

  const enRetard = dues.filter((c) => (c.next_action_at as string).slice(0, 10) < cle);
  const duJour = dues.length - enRetard.length;
  const apercu = dues.slice(0, 3);

  return (
    <div className="bg-[#1A1D24] rounded-2xl p-[18px] border border-white/[0.05]">
      {/* Pas de compteur à droite du titre (revue Preview 2026-09-16) : il
          répétait le total que la ligne « N en retard · N aujourd'hui »
          détaille juste en dessous. Le total reste dans « Voir les N
          relances » quand l'aperçu en cache une partie. */}
      <h2 className="font-head text-[15px] font-black text-white uppercase tracking-tight">
        Relances aujourd&apos;hui
      </h2>

      <p className="text-[12px] text-[#9CA3AF] mt-1">
        {enRetard.length > 0 && (
          <span className="font-bold" style={{ color: "#F59E0B" }}>
            {enRetard.length} en retard
          </span>
        )}
        {enRetard.length > 0 && duJour > 0 && " · "}
        {duJour > 0 && `${duJour} aujourd'hui`}
      </p>

      <div className="mt-3 space-y-1">
        {apercu.map((c) => {
          const retard = (c.next_action_at as string).slice(0, 10) < cle;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onTapAthlete(c.id)}
              /* `active:` pour le doigt, `hover:` pour le curseur — le même
                 composant sert les deux plateformes, et `hover:` est inerte
                 au toucher. */
              className="w-full flex items-center gap-2.5 py-2 px-2 -mx-2 rounded-xl hover:bg-white/[0.04] active:bg-white/[0.05] transition-colors text-left"
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: retard ? "#F59E0B" : "#E63946" }}
                aria-hidden
              />
              <span className="flex-1 text-[14px] text-white truncate">{c.full_name || "Athlète"}</span>
              {retard && (
                <span className="text-[10px] font-black uppercase tracking-[0.12em] shrink-0" style={{ color: "#F59E0B" }}>
                  En retard
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onTapToutVoir}
        className="mt-3 w-full py-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] active:bg-white/[0.08] text-[#E63946] font-semibold text-[14px] transition-colors"
      >
        {dues.length > apercu.length ? `Voir les ${dues.length} relances` : "Ouvrir Mon processus"}
      </button>
    </div>
  );
}

export default RelancesDuJour;
