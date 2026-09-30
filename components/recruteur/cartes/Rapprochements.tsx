"use client";

/* ═══════════════════════════════════════════════════════════════
   Rapprochements — lot D, côté Mon processus.

   · BandeauRapprochements : « N profils semblent correspondre à tes cartes »
     en tête de Mon processus ;
   · LienRapprochementCarte : « Un profil semble correspondre → voir » sur la
     carte (kanban et panneau) ;
   · FenetreRapprochements : la carte et le profil côte à côte, Accepter /
     Refuser. Accepter = fusion (lot E) ; tant que `onAccepter` est absent, le
     bouton est présent mais inactif, et le dit.

   Le contexte évite de faire descendre les propositions à travers le kanban
   et le panneau : ils demandent seulement « cette carte a-t-elle une
   proposition ? » et « ouvre la fenêtre ».
═══════════════════════════════════════════════════════════════ */

import { createContext, useContext, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  useRapprochements, refuserRapprochement, raisonRapprochement, libelleCorrespondance, type Rapprochement,
} from "@/lib/cartes/rapprochements";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";
import AthletePhoto from "@/components/shared/AthletePhoto";

interface ContexteRapprochements {
  parCarte: Map<string, number>;
  ouvrir: (carteId?: string) => void;
}
const Contexte = createContext<ContexteRapprochements>({ parCarte: new Map(), ouvrir: () => {} });
export const useContexteRapprochements = () => useContext(Contexte);

export function FournisseurRapprochements({
  actif, onAccepter, children,
}: {
  actif: boolean;
  /** Lot E : fusionne la carte et le profil. Absent → Accepter inactif. */
  onAccepter?: (r: Rapprochement) => Promise<string | null>;
  children: React.ReactNode;
}) {
  const { data: propositions = [] } = useRapprochements(actif);
  const [ouverte, setOuverte] = useState<{ carteId?: string } | null>(null);
  const parCarte = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of propositions) m.set(p.carte_id, (m.get(p.carte_id) ?? 0) + 1);
    return m;
  }, [propositions]);
  const valeur = useMemo(() => ({ parCarte, ouvrir: (carteId?: string) => setOuverte({ carteId }) }), [parCarte]);
  return (
    <Contexte.Provider value={valeur}>
      {children}
      {ouverte && (
        <FenetreRapprochements
          propositions={ouverte.carteId ? propositions.filter((p) => p.carte_id === ouverte.carteId) : propositions}
          onFermer={() => setOuverte(null)}
          onAccepter={onAccepter}
        />
      )}
    </Contexte.Provider>
  );
}

export function BandeauRapprochements() {
  const { parCarte, ouvrir } = useContexteRapprochements();
  const n = [...parCarte.values()].reduce((a, b) => a + b, 0);
  if (n === 0) return null;
  return (
    <div role="note" data-testid="bandeau-rapprochements"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#3B82F6]/30 bg-[#3B82F6]/[0.07] px-4 py-3">
      <p className="text-[13px] text-[#E5E7EB]">
        <span className="font-bold text-white">{n > 1 ? `${n} profils semblent` : "1 profil semble"}</span>{" "}
        correspondre à tes cartes prospect.
      </p>
      <button type="button" onClick={() => ouvrir()}
        className="px-3.5 py-1.5 rounded-lg border border-white/30 text-[12px] font-bold text-white hover:bg-white/5 transition-colors">
        Voir {n > 1 ? "les propositions" : "la proposition"}
      </button>
    </div>
  );
}

/** Sur une carte prospect : rien si aucune proposition. `stopPropagation`
 *  pour ne pas ouvrir le panneau du kanban en même temps. */
export function LienRapprochementCarte({ carteId, className = "" }: { carteId: string; className?: string }) {
  const { parCarte, ouvrir } = useContexteRapprochements();
  const n = parCarte.get(carteId) ?? 0;
  if (n === 0) return null;
  return (
    <span role="button" tabIndex={0} data-testid="lien-rapprochement"
      onClick={(e) => { e.stopPropagation(); ouvrir(carteId); }}
      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); ouvrir(carteId); } }}
      className={`inline-flex items-center gap-1 text-[12px] font-semibold text-[#93C5FD] hover:text-white cursor-pointer ${className}`}>
      {n > 1 ? `${n} profils semblent correspondre` : "Un profil semble correspondre"} → voir
    </span>
  );
}

function Colonne({ titre, lignes, photo }: {
  titre: string;
  lignes: { libelle: string; valeur: React.ReactNode }[];
  photo?: React.ReactNode;
}) {
  return (
    <div className="flex-1 min-w-0 rounded-lg border border-[#2D3748] bg-[#13151a] p-4">
      <div className="flex items-center gap-3 mb-3">
        {photo}
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7280]">{titre}</p>
      </div>
      <dl className="space-y-1.5">
        {lignes.map((l) => (
          <div key={l.libelle} className="flex items-baseline justify-between gap-3">
            <dt className="text-[12px] text-[#6b7280] shrink-0">{l.libelle}</dt>
            <dd className="text-[13px] text-white text-right truncate">{l.valeur ?? <span className="text-[#4a4d56]">—</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function FenetreRapprochements({ propositions, onFermer, onAccepter }: {
  propositions: Rapprochement[];
  onFermer: () => void;
  onAccepter?: (r: Rapprochement) => Promise<string | null>;
}) {
  const queryClient = useQueryClient();
  const [enCours, setEnCours] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refuser = async (r: Rapprochement) => {
    setEnCours(r.id);
    const err = await refuserRapprochement(createClient(), r.id);
    setEnCours(null);
    setMessage(err ? "La proposition n'a pas pu être refusée. Réessaie." : `Refusé : ce profil ne sera plus proposé pour « ${r.carte_prenom} ${r.carte_nom} ».`);
    void invaliderTableauBlanc(queryClient);
  };
  const accepter = async (r: Rapprochement) => {
    if (!onAccepter) return;
    setEnCours(r.id);
    const err = await onAccepter(r);
    setEnCours(null);
    setMessage(err ?? `Fusionné : « ${r.athlete_prenom} ${r.athlete_nom} » reprend le suivi de la carte.`);
    void invaliderTableauBlanc(queryClient);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="titre-rapprochements">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFermer} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-3xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 id="titre-rapprochements" className="font-head text-[18px] font-black text-white uppercase tracking-tight">
          Profils qui semblent correspondre
        </h3>
        <p className="text-[13px] text-[#9CA3AF] mt-1">
          Un athlète est arrivé sur Nexus et semble être l&apos;une de tes cartes prospect. Compare, puis décide pour ton unité.
        </p>
        {message && <p role="status" className="mt-3 text-[13px] text-[#E5E7EB]">{message}</p>}

        {propositions.length === 0 ? (
          <p className="mt-6 text-[14px] text-[#6b7280]">Aucune proposition en attente.</p>
        ) : propositions.map((r) => (
          <section key={r.id} className="mt-5 border-t border-[#2D3748] pt-5" data-testid="proposition">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                r.force === "FORTE" ? "border-[#22C55E]/40 bg-[#22C55E]/10 text-[#86EFAC]"
                : r.force === "MOYENNE" ? "border-white/30 bg-white/5 text-white"
                : "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FCD34D]"}`}>
                {libelleCorrespondance(r)}
              </span>
              <span className="text-[12px] text-[#9CA3AF]">{raisonRapprochement(r)}</span>
              {r.promotion_concorde === false && <span className="text-[12px] text-[#FCD34D]">· promotion différente</span>}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Colonne titre="Ta carte prospect" lignes={[
                { libelle: "Nom", valeur: `${r.carte_prenom} ${r.carte_nom}` },
                { libelle: "École", valeur: r.carte_ecole },
                { libelle: "Équipe", valeur: r.carte_equipe },
                { libelle: "Promotion", valeur: r.carte_promotion },
                { libelle: "Position", valeur: r.carte_position },
              ]} />
              <Colonne titre="Profil Nexus"
                photo={<div className="relative w-9 h-9 shrink-0"><AthletePhoto photoUrl={r.athlete_photo_url ?? ""} firstName={r.athlete_prenom} lastName={r.athlete_nom} identityVisible size={36} /></div>}
                lignes={[
                  { libelle: "Nom", valeur: <Link href={`/recruteur/athletes/${r.athlete_id}`} className="underline hover:text-[#E63946]">{r.athlete_prenom} {r.athlete_nom}</Link> },
                  { libelle: "École", valeur: r.athlete_ecole },
                  { libelle: "Équipe", valeur: r.athlete_equipes },
                  { libelle: "Promotion", valeur: r.athlete_promotion },
                  { libelle: "Position", valeur: r.athlete_position },
                ]} />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 mt-4">
              {!onAccepter && <span className="text-[12px] text-[#6b7280]">La fusion arrive avec le lot E.</span>}
              <button type="button" onClick={() => void refuser(r)} disabled={enCours === r.id}
                className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] border border-[#2D3748] rounded-lg hover:text-white hover:border-[#4a4d56] disabled:opacity-40">
                Refuser
              </button>
              <button type="button" onClick={() => void accepter(r)} disabled={!onAccepter || enCours === r.id}
                title={onAccepter ? undefined : "La fusion arrive avec le lot E"}
                className="px-4 py-2 bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-bold rounded-lg">
                Accepter
              </button>
            </div>
          </section>
        ))}
        <div className="flex justify-end mt-6">
          <button type="button" onClick={onFermer} className="px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] hover:text-white">Fermer</button>
        </div>
      </div>
    </div>
  );
}
