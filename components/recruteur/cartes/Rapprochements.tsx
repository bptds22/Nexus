"use client";

/* ═══════════════════════════════════════════════════════════════
   Rapprochements — lot D, côté Mon processus.

   · BandeauRapprochements : « N profils semblent correspondre à tes cartes »
     en tête de Mon processus ;
   · LienRapprochementCarte : « Un profil semble correspondre → voir » sur la
     carte (kanban et panneau) ;
   · FenetreRapprochements : la carte et le profil côte à côte, Accepter /
     Refuser. Accepter = fusion (lot E, `onAccepter`) : la carte disparaît,
     le suivi passe au profil, annulable 7 jours depuis l'Historique.
   · 1.4.5 (A7) : la MÊME fenêtre dans l'appli, en feuille du bas
     (`variante="feuille"`). Logique (refuser, accepter, messages) et bloc
     de proposition sont communs aux deux présentations.

   Le contexte évite de faire descendre les propositions à travers le kanban
   et le panneau : ils demandent seulement « cette carte a-t-elle une
   proposition ? » et « ouvre la fenêtre ».
═══════════════════════════════════════════════════════════════ */

import { createContext, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  useRapprochements, useRapprochementsRefuses, refuserRapprochement, reproposerRapprochement, raisonRapprochement,
  CLE_RAPPROCHEMENTS_REFUSES, type Rapprochement, type RapprochementRefuse,
} from "@/lib/cartes/rapprochements";
import { niveauRapprochement, libelleNiveau, differences } from "@/lib/cartes/niveauRapprochement";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";
import AthletePhoto from "@/components/shared/AthletePhoto";

interface ContexteRapprochements {
  parCarte: Map<string, number>;
  /** Propositions refusées de l'unité (BP 2026-10-19 : les revoir). */
  nbRefusees: number;
  ouvrir: (carteId?: string) => void;
}
const Contexte = createContext<ContexteRapprochements>({ parCarte: new Map(), nbRefusees: 0, ouvrir: () => {} });
export const useContexteRapprochements = () => useContext(Contexte);

export function FournisseurRapprochements({
  actif, onAccepter, variante = "modale", children,
}: {
  actif: boolean;
  /** Lot E : fusionne la carte et le profil ; rend un message d'erreur ou null. */
  onAccepter?: (r: Rapprochement) => Promise<string | null>;
  /** « feuille » : l'appli (feuille du bas presque plein écran) ; « modale » : le web. */
  variante?: "modale" | "feuille";
  children: React.ReactNode;
}) {
  const { data: propositions = [] } = useRapprochements(actif);
  const { data: refusees = [] } = useRapprochementsRefuses(actif);
  const [ouverte, setOuverte] = useState<{ carteId?: string } | null>(null);
  const parCarte = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of propositions) m.set(p.carte_id, (m.get(p.carte_id) ?? 0) + 1);
    return m;
  }, [propositions]);
  const valeur = useMemo(() => ({ parCarte, nbRefusees: refusees.length, ouvrir: (carteId?: string) => setOuverte({ carteId }) }), [parCarte, refusees.length]);
  return (
    <Contexte.Provider value={valeur}>
      {children}
      {ouverte && (() => {
        const liste = ouverte.carteId ? propositions.filter((p) => p.carte_id === ouverte.carteId) : propositions;
        const refuseesListe = ouverte.carteId ? refusees.filter((p) => p.carte_id === ouverte.carteId) : refusees;
        const Fenetre = variante === "feuille" ? FeuilleRapprochements : FenetreRapprochements;
        return <Fenetre propositions={liste} refusees={refuseesListe} onFermer={() => setOuverte(null)} onAccepter={onAccepter} />;
      })()}
    </Contexte.Provider>
  );
}

export function BandeauRapprochements({ className = "" }: { className?: string }) {
  const { parCarte, ouvrir } = useContexteRapprochements();
  const n = [...parCarte.values()].reduce((a, b) => a + b, 0);
  // Rien à décider : rien en haut. Les refusées se revoient dans « Propositions » (BP 2026-10-19).
  if (n === 0) return null;
  return (
    <div role="note" data-testid="bandeau-rapprochements"
      className={`${className} flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#3B82F6]/30 bg-[#3B82F6]/[0.07] px-4 py-3`}>
      <p className="text-[13px] text-[#E5E7EB]">
        <span className="font-bold text-white">{n > 1 ? `${n} profils semblent` : "1 profil semble"}</span>{" "}
        correspondre à tes cartes prospect.
      </p>
      <button type="button" onClick={() => ouvrir()}
        className="min-h-[36px] px-3.5 py-1.5 rounded-lg border border-white/30 text-[12px] font-bold text-white hover:bg-white/5 transition-colors">
        Voir {n > 1 ? "les propositions" : "la proposition"}
      </button>
    </div>
  );
}

/** « Propositions » — TOUJOURS là dans Mon processus (BP 2026-10-19 : « pas d'endroit pour revoir les
 *  profils que j'ai refusés »). Ouvre la fenêtre : en attente, puis les refusées. */
export function BoutonPropositions({ tactile = false, actif = true }: { tactile?: boolean; actif?: boolean }) {
  const { parCarte, nbRefusees, ouvrir } = useContexteRapprochements();
  if (!actif) return null;
  const n = [...parCarte.values()].reduce((a, b) => a + b, 0);
  return (
    <button type="button" onClick={() => ouvrir()} data-testid="bouton-propositions"
      title={nbRefusees > 0 ? `${nbRefusees} refusée${nbRefusees > 1 ? "s" : ""} à revoir` : "Profils Nexus qui semblent correspondre à tes cartes"}
      className={tactile
        ? "relative h-11 px-4 rounded-full flex items-center justify-center gap-1.5 bg-white/[0.06] active:bg-white/[0.1] text-[13px] font-bold text-white"
        : "flex items-center gap-2 px-5 py-3 rounded-xl border border-[#2a2d36] bg-[#13151a] text-[14px] font-bold text-white hover:border-[#4a4d56] transition-colors"}>
      Propositions
      {n > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#3B82F6] text-white text-[10px] font-black leading-none">{n}</span>
      )}
    </button>
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

/** Refuser / Accepter et le message qui suit — communs au web et à l'appli. */
function useActionsRapprochement(onAccepter?: (r: Rapprochement) => Promise<string | null>) {
  const queryClient = useQueryClient();
  const [enCours, setEnCours] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refuser = async (r: Rapprochement) => {
    setEnCours(r.id);
    const err = await refuserRapprochement(createClient(), r.id);
    setEnCours(null);
    setMessage(err ? "La proposition n'a pas pu être refusée. Réessaie." : `Refusé : ce profil ne sera plus proposé pour « ${r.carte_prenom} ${r.carte_nom} ». Tu le retrouves dans « Propositions refusées ».`);
    void queryClient.invalidateQueries({ queryKey: [CLE_RAPPROCHEMENTS_REFUSES] });
    void invaliderTableauBlanc(queryClient);
  };
  const accepter = async (r: Rapprochement) => {
    if (!onAccepter) return;
    setEnCours(r.id);
    const err = await onAccepter(r);
    setEnCours(null);
    setMessage(err ?? `Fusionné : « ${r.athlete_prenom} ${r.athlete_nom} » reprend le suivi de la carte « ${r.carte_prenom} ${r.carte_nom} ». Tu peux annuler pendant 7 jours depuis l'Historique du dossier.`);
    void invaliderTableauBlanc(queryClient);
  };
  const reproposer = async (r: RapprochementRefuse) => {
    setEnCours(r.id);
    const err = await reproposerRapprochement(createClient(), r.id);
    setEnCours(null);
    setMessage(err ? "La proposition n'a pas pu revenir. Réessaie." : `« ${r.athlete_prenom} ${r.athlete_nom} » est de nouveau proposé pour « ${r.carte_prenom} ${r.carte_nom} » : tu peux l'accepter plus haut.`);
    void queryClient.invalidateQueries({ queryKey: [CLE_RAPPROCHEMENTS_REFUSES] });
    void invaliderTableauBlanc(queryClient);
  };
  return { enCours, message, refuser, accepter, reproposer, peutAccepter: !!onAccepter };
}

/** Les refusées, repliées sous les propositions : qui a refusé, quand, « Proposer de nouveau ». */
function Refusees({ refusees, a, tactile = false }: { refusees: RapprochementRefuse[]; a: Actions; tactile?: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  if (refusees.length === 0) return null;
  return (
    <section className="mt-6 border-t border-[#2D3748] pt-4" data-testid="propositions-refusees">
      <button type="button" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}
        className="min-h-[40px] text-[12px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF] hover:text-white">
        Propositions refusées ({refusees.length}) {ouvert ? "▴" : "▾"}
      </button>
      {ouvert && (
        <ul className="mt-2 space-y-2">
          {refusees.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#2D3748] bg-[#13151a] px-3 py-2.5">
              <span className="min-w-0 text-[13px] text-[#c8c8cc]">
                <span className="font-semibold text-white">{r.carte_prenom} {r.carte_nom}</span> ↔ {r.athlete_prenom} {r.athlete_nom}
                <span className="block text-[11px] text-[#6b7280]">
                  {raisonRapprochement(r)}
                  {r.decide_par_nom ? ` · refusé par ${r.decide_par_nom}` : ""}
                  {r.decide_le ? `, ${new Date(r.decide_le).toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}` : ""}
                </span>
              </span>
              <button type="button" onClick={() => void a.reproposer(r)} disabled={a.enCours === r.id}
                className={`${tactile ? "min-h-[44px]" : ""} shrink-0 px-3 py-1.5 text-[12px] font-bold text-white border border-white/30 rounded-lg hover:bg-white/5 disabled:opacity-40`}>
                Proposer de nouveau
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Actions = ReturnType<typeof useActionsRapprochement>;

const TITRE_FENETRE = "Profils qui semblent correspondre";
const INTRO_FENETRE = "Un athlète est arrivé sur Nexus et semble être l'une de tes cartes prospect. Compare, puis décide pour ton unité.";

/** Une proposition : niveau, raison, écarts, la carte et le profil côte à côte,
 *  Refuser / Accepter. `tactile` : boutons à 44 px (appli). */
function Proposition({ r, a, tactile = false }: { r: Rapprochement; a: Actions; tactile?: boolean }) {
  const niveau = niveauRapprochement(r.critere);
  const ecarts = niveau === "POSSIBLE" ? differences(r) : [];
  const bouton = tactile ? "min-h-[44px] flex-1 sm:flex-none" : "";
  return (
    <section className="mt-5 border-t border-[#2D3748] pt-5" data-testid="proposition">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span data-testid="niveau-proposition" className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
          niveau === "CONFIRMEE" || niveau === "CONFIRMEE_TELEPHONE" ? "border-[#22C55E]/40 bg-[#22C55E]/10 text-[#86EFAC]"
          : niveau === "MEME_NOM_EQUIPE" || niveau === "MEME_NOM_ETABLISSEMENT" ? "border-white/30 bg-white/5 text-white"
          : "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FCD34D]"}`}>
          {libelleNiveau(niveau)}
        </span>
        <span className="text-[12px] text-[#9CA3AF]">{raisonRapprochement(r)}</span>
        {niveau !== "POSSIBLE" && r.promotion_concorde === false && <span className="text-[12px] text-[#FCD34D]">· promotion différente</span>}
      </div>
      {ecarts.length > 0 && (
        <ul className="mb-3 space-y-0.5 text-[12px] text-[#FCD34D]" aria-label="Ce qui diffère">
          {ecarts.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
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
        <button type="button" onClick={() => void a.refuser(r)} disabled={a.enCours === r.id}
          className={`${bouton} px-4 py-2 text-[13px] font-bold text-[#9CA3AF] border border-[#2D3748] rounded-lg hover:text-white hover:border-[#4a4d56] disabled:opacity-40`}>
          Refuser
        </button>
        <button type="button" onClick={() => void a.accepter(r)} disabled={!a.peutAccepter || a.enCours === r.id}
          title="Fusionner : le suivi de la carte passe à ce profil, la carte disparaît"
          className={`${bouton} px-4 py-2 bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-bold rounded-lg`}>
          Accepter
        </button>
      </div>
    </section>
  );
}

function FenetreRapprochements({ propositions, refusees, onFermer, onAccepter }: {
  propositions: Rapprochement[];
  refusees: RapprochementRefuse[];
  onFermer: () => void;
  onAccepter?: (r: Rapprochement) => Promise<string | null>;
}) {
  const a = useActionsRapprochement(onAccepter);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="titre-rapprochements">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFermer} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-3xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 id="titre-rapprochements" className="font-head text-[18px] font-black text-white uppercase tracking-tight">{TITRE_FENETRE}</h3>
        <p className="text-[13px] text-[#9CA3AF] mt-1">{INTRO_FENETRE}</p>
        {a.message && <p role="status" className="mt-3 text-[13px] text-[#E5E7EB]">{a.message}</p>}
        {propositions.length === 0 ? (
          <p className="mt-6 text-[14px] text-[#6b7280]">Aucune proposition en attente.</p>
        ) : propositions.map((r) => <Proposition key={r.id} r={r} a={a} />)}
        <Refusees refusees={refusees} a={a} />
        <div className="flex justify-end mt-6">
          <button type="button" onClick={onFermer} className="px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] hover:text-white">Fermer</button>
        </div>
      </div>
    </div>
  );
}

/* L'appli (A7) : feuille du bas presque plein écran, défilable, portée sur
   document.body (un ancêtre transformé capturerait le `fixed`). Aucun champ de
   saisie : pas de géométrie clavier à gérer. La zone sûre du bas est rendue. */
function FeuilleRapprochements({ propositions, refusees, onFermer, onAccepter }: {
  propositions: Rapprochement[];
  refusees: RapprochementRefuse[];
  onFermer: () => void;
  onAccepter?: (r: Rapprochement) => Promise<string | null>;
}) {
  const a = useActionsRapprochement(onAccepter);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-labelledby="titre-rapprochements" data-feuille-rapprochements>
      <div className="absolute inset-0 bg-black/60" onClick={onFermer} />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-2xl bg-[#1A1D24] border-t border-[#2D3748]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-white/[0.06]">
          <div className="min-w-0">
            <h3 id="titre-rapprochements" className="font-head text-[17px] font-black text-white uppercase tracking-tight">{TITRE_FENETRE}</h3>
            <p className="text-[12px] text-[#9CA3AF] mt-1 leading-relaxed">{INTRO_FENETRE}</p>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer"
            className="shrink-0 w-11 h-11 -mr-2 rounded-full flex items-center justify-center active:bg-white/[0.08]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
          {a.message && <p role="status" className="mt-3 text-[13px] text-[#E5E7EB]">{a.message}</p>}
          {propositions.length === 0 ? (
            <p className="mt-6 text-[14px] text-[#6b7280]">Aucune proposition en attente.</p>
          ) : propositions.map((r) => <Proposition key={r.id} r={r} a={a} tactile />)}
          <Refusees refusees={refusees} a={a} tactile />
        </div>
      </div>
    </div>,
    document.body,
  );
}
