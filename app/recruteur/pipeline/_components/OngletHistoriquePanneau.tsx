"use client";

/* ═══════════════════════════════════════════════════════════════
   OngletHistoriquePanneau — l'onglet « Historique » du panneau de « Mon
   processus » (lot B2, étape 1 ; décision BP 2026-09-24, question 5).

   Les gestes de l'UNITÉ sur cet athlète, du plus récent au plus ancien,
   chacun signé par qui l'a fait : étapes, retraits, favoris, notes,
   listes. La base décide de ce qui est lisible (policy
   unite_journal_select, Pro seulement) et signe chaque ligne par l'acteur
   (lot B2-0) ; ce composant ne fait que raconter.

   Le journal d'unité commence à l'apply de B2-0 : les gestes plus anciens
   n'y figurent que pour leur auteur lui-même.

   Lot E : une fusion carte → profil s'y lit comme une ligne (« a fusionné
   la carte prospect… ») ; tant qu'elle est annulable (7 jours), un encadré
   en tête propose « Annuler la fusion » et, une fois fait, dit ce qui a été
   retiré et ce qui a été gardé parce que modifié depuis.

   Monté SEULEMENT quand l'onglet est ouvert : rien n'est chargé tant qu'on
   ne le demande pas.
═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useHistoriqueUnite, useAuteursUnite, nomAuteur, type GesteUnite } from "@/lib/queries/recruiter/useProcessusUnite";
import { useFusionsAthlete, annulerFusion, type Fusion, type ResultatAnnulation } from "@/lib/cartes/fusions";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";
import { phraseFusion } from "@/lib/cartes/phraseFusion";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { KANBAN_COLUMNS } from "../_data/mockKanbanData";
import { ligneSignee } from "@/lib/historique/signature";

function libelleEtape(stage: unknown): string {
  if (typeof stage !== "string" || !stage) return "";
  const id = stage.toLowerCase();
  return KANBAN_COLUMNS.find((c) => c.id === id)?.label ?? stage;
}

/** Ce qu'a fait l'auteur, en une phrase (sans le nom : il est affiché
 *  devant). Aucun contenu de note n'est repris : le journal dit QU'une note
 *  a été ajoutée, les notes elles-mêmes vivent dans l'onglet Actions. */
export function phraseGeste(g: Pick<GesteUnite, "action_type" | "details">): string {
  const d = g.details ?? {};
  switch (g.action_type) {
    case "PIPELINE_CHANGED": {
      const fusion = phraseFusion(d, libelleEtape(d.new_stage));
      if (fusion) return fusion;
      if (d.retire === true) {
        return d.unite === true ? "a retiré l'athlète du processus de l'unité" : "a retiré l'athlète du processus";
      }
      const vers = libelleEtape(d.new_stage);
      const depuis = libelleEtape(d.before_stage);
      if (!depuis) return `a ajouté l'athlète au processus${vers ? ` (${vers})` : ""}`;
      return `a déplacé le dossier vers ${vers}${depuis ? ` (depuis ${depuis})` : ""}`;
    }
    case "FAVORITED": return "a ajouté l'athlète aux favoris";
    case "UNFAVORITED": return d.unite === true ? "a retiré l'athlète des favoris de l'unité" : "a retiré l'athlète des favoris";
    case "NOTE_ADDED": return "a ajouté une note de suivi";
    case "NOTE_UPDATED": return "a modifié une note de suivi";
    case "ATHLETE_ADDED_TO_LIST": return `a ajouté l'athlète à la liste ${typeof d.list_name === "string" ? `« ${d.list_name} »` : ""}`.trim();
    case "ATHLETE_REMOVED_FROM_LIST": return `a retiré l'athlète de la liste ${typeof d.list_name === "string" ? `« ${d.list_name} »` : ""}`.trim();
    case "LIST_NOTE_ADDED": return "a annoté une liste";
    case "LIST_CREATED": return "a créé une liste";
    default: return "a agi sur le dossier";
  }
}

function quand(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
  const heure = d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${heure}`;
}

/** L'encadré « Annuler la fusion » : une fusion encore annulable. Deux
 *  temps (Annuler → Confirmer), jamais de boîte de dialogue du navigateur. */
function FusionAnnulable({ fusion, auteur, resultat, onAnnulee }: {
  fusion: Fusion;
  auteur: string;
  /** Tenu par le parent : la relecture qui suit l'annulation ne l'efface pas. */
  resultat: ResultatAnnulation | undefined;
  onAnnulee: (r: ResultatAnnulation) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const annuler = async () => {
    setEnCours(true);
    const { resultat: r, erreur: e } = await annulerFusion(createClient(), fusion.id);
    setEnCours(false);
    setErreur(e);
    if (r) {
      onAnnulee(r);
      void invaliderTableauBlanc(queryClient);
    }
  };

  if (resultat) {
    return (
      <div role="status" data-testid="fusion-annulee" className="mb-4 rounded-lg border border-[#2D3748] bg-[#13151a] px-3.5 py-3 text-[13px] text-[#e0e0e0] leading-snug">
        <p className="font-bold text-white">Fusion annulée : la carte « {fusion.carte_libelle} » est de retour.</p>
        {resultat.retires.length > 0 && <p className="mt-1">Retiré (inchangé depuis la fusion) : {resultat.retires.join(", ")}.</p>}
        {resultat.conserves.length > 0 && <p className="mt-1">Gardé (modifié depuis la fusion) : {resultat.conserves.join(", ")}.</p>}
      </div>
    );
  }
  return (
    <div data-testid="fusion-annulable" className="mb-4 rounded-lg border border-[#2D3748] bg-[#13151a] px-3.5 py-3">
      <p className="text-[13px] text-[#e0e0e0] leading-snug">
        Carte prospect « <span className="font-bold text-white">{fusion.carte_libelle}</span> » fusionnée avec ce profil par {auteur}, le {jour(fusion.fusionnee_le)}.
      </p>
      <p className="text-[12px] text-[#6b7280] mt-1">
        Annulable jusqu&apos;au {jour(fusion.annulable_jusqu_au)}. Ce qui n&apos;a pas bougé depuis sera retiré ; ce qui a été modifié sera gardé.
      </p>
      {erreur && <p role="alert" className="text-[12px] text-[#FCA5A5] mt-2">{erreur}</p>}
      <div className="flex flex-wrap gap-2 mt-2.5">
        {confirmer ? (
          <>
            <button type="button" onClick={() => void annuler()} disabled={enCours}
              className="px-3 py-1.5 rounded-lg bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-40 text-white text-[12px] font-bold">
              Confirmer l&apos;annulation
            </button>
            <button type="button" onClick={() => setConfirmer(false)} disabled={enCours}
              className="px-3 py-1.5 text-[12px] font-bold text-[#9CA3AF] hover:text-white">
              Garder la fusion
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmer(true)}
            className="px-3 py-1.5 rounded-lg border border-[#2D3748] text-[12px] font-bold text-[#e0e0e0] hover:text-white hover:border-[#4a4d56]">
            Annuler la fusion
          </button>
        )}
      </div>
    </div>
  );
}

function jour(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
}

export default function OngletHistoriquePanneau({ athleteId }: { athleteId: string }) {
  const { data: gestes = [], isLoading, isError } = useHistoriqueUnite(athleteId);
  const { data: auteurs = {} } = useAuteursUnite();
  const { data: currentUser } = useCurrentUser();
  const moi = currentUser?.authUser.id;
  const { data: fusions = [] } = useFusionsAthlete(athleteId);
  const [annulees, setAnnulees] = useState<Record<string, ResultatAnnulation>>({});
  const encadres = fusions.filter((f) => f.annulable || annulees[f.id]).map((f) => (
    <FusionAnnulable key={f.id} fusion={f}
      auteur={f.acteur === moi ? "toi" : nomAuteur(auteurs[f.acteur ?? ""])}
      resultat={annulees[f.id]}
      onAnnulee={(r) => setAnnulees((a) => ({ ...a, [f.id]: r }))} />
  ));

  if (isLoading) {
    return (
      <div className="py-16 flex justify-center" role="status" aria-label="Chargement de l'historique">
        <div className="w-6 h-6 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (isError) {
    return <p className="py-12 text-center text-[13px] text-[#6b7280]">L&apos;historique est indisponible pour le moment.</p>;
  }
  if (gestes.length === 0) {
    return (
      <>
      {encadres}
      <p className="py-12 text-center text-[13px] text-[#6b7280] leading-relaxed">
        Aucun geste enregistré sur ce dossier.
        <br />
        <span className="text-[12px] text-[#4a4d56]">L&apos;historique de l&apos;unité commence avec le tableau partagé.</span>
      </p>
      </>
    );
  }

  return (
    <div>
      {encadres}
      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">Historique de l&apos;unité</h3>
      <ol className="space-y-0">
        {gestes.map((g, i) => (
          <li
            key={g.id}
            className={`relative pl-5 pb-4 ml-1.5 ${i < gestes.length - 1 ? "border-l border-[#2D3748]" : "border-l border-transparent"}`}
          >
            <div className="absolute left-[-4px] top-1 w-2 h-2 rounded-full bg-[#9CA3AF]" />
            {(() => {
              const l = ligneSignee(g.recruiter_id === moi, nomAuteur(auteurs[g.recruiter_id]), phraseGeste(g));
              return (
                <p className="text-[13px] text-[#e0e0e0] leading-snug">
                  <span className="font-bold text-white">{l.sujet}</span> {l.phrase}
                </p>
              );
            })()}
            <p className="text-[11px] text-[#6b7280] mt-0.5">{quand(g.created_at)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
