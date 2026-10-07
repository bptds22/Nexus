"use client";

/* ═══════════════════════════════════════════════════════════════
   FilNotesSuiviMobile — le fil de notes d'un joueur, version tactile
   (lot 2 de la 1.4.4, jumeau de components/recruteur/notes/FilNotesSuivi).

   UN SEUL FIL PAR JOUEUR (décision BP, lot C) : recruiter_notes, celles de
   l'UNITÉ (la RLS les rend à un Pro de l'unité), SIGNÉES. Les miennes se
   suppriment (confirmation en ligne) ; celles des collègues se lisent sans
   se modifier ni se supprimer — la RLS en décide aussi.

   Différences avec le web, toutes tactiles :
     · la croix de suppression est TOUJOURS visible sur mes notes (pas de
       survol au doigt) ;
     · champ en 16 px (pas de zoom iOS), bouton « Poster » à 44 px.

   `modeUnite` faux (compte gratuit, mode démo) : mes notes seulement, et
   « Poster » renvoie à l'offre Pro (`onTease`) — la RLS refuserait.
   `lectureSeule` : aucun champ, aucune croix.
   `carteId` : carte prospect (lot C) — son PROPRE fil (cartes_prospect_notes),
   comme le web (FilNotesSuivi).
   `replie` : le fil s'ouvre au toucher sur « Notes (N) » (recette 1.4.4, BP
   2026-10-02) — le panneau ne s'allonge plus d'office de tout l'historique.

   Le conteneur parent (sheet) porte useSheetKeyboardGeometry : le champ
   reste au-dessus du clavier (CLAUDE.md, « Clavier mobile »).
═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useNotesUnite, useAuteursUnite, nomAuteur } from "@/lib/queries/recruiter/useProcessusUnite";
import { usePipelineNotes } from "@/lib/queries/recruiter/usePipelineNotes";
import { useAddPipelineNote } from "@/lib/queries/recruiter/useAddPipelineNote";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";
import { triggerHaptic } from "@/lib/haptics";
import { useNotesCarte } from "@/lib/cartes/useCartes";
import { ajouterNoteCarte } from "@/lib/cartes/carteProspect";

interface Note { id: string; content: string; created_at: string; recruiter_id?: string }

export default function FilNotesSuiviMobile({
  athleteId,
  modeUnite,
  lectureSeule = false,
  onTease,
  onErreur,
  titre = "Notes",
  carteId = null,
  replie: replieInitial = true,
}: {
  athleteId: string;
  modeUnite: boolean;
  lectureSeule?: boolean;
  onTease?: () => void;
  onErreur?: (message: string) => void;
  titre?: string;
  carteId?: string | null;
  replie?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const moi = currentUser?.authUser.id ?? null;

  const surCarte = !!carteId;
  const { data: notesUnite = [], isLoading: lUnite } = useNotesUnite(modeUnite && !surCarte ? athleteId : null);
  const { data: notesDemo = [], isLoading: lDemo } = usePipelineNotes(modeUnite || surCarte ? null : athleteId);
  const { data: notesCarte = [], isLoading: lCarte } = useNotesCarte(carteId);
  const { data: auteurs = {} } = useAuteursUnite(modeUnite);
  const ajouter = useAddPipelineNote();
  const [envoiCarte, setEnvoiCarte] = useState(false);
  const notes: Note[] = surCarte ? notesCarte : modeUnite ? notesUnite : notesDemo.map((n) => ({ ...n, recruiter_id: moi ?? undefined }));
  const chargement = surCarte ? lCarte : modeUnite ? lUnite : lDemo;
  const enCours = surCarte ? envoiCarte : ajouter.isPending;

  const [ouvert, setOuvert] = useState(!replieInitial);
  const [texte, setTexte] = useState("");
  const [aSupprimer, setASupprimer] = useState<string | null>(null);

  const signature = (id: string | undefined) => (!id ? null : id === moi ? "Moi" : nomAuteur(auteurs[id]));

  const poster = async () => {
    const contenu = texte.trim();
    if (!contenu || enCours) return;
    if (!modeUnite) { onTease?.(); setTexte(""); return; }
    if (surCarte) {
      setEnvoiCarte(true);
      const erreur = await ajouterNoteCarte(createClient(), carteId!, contenu);
      setEnvoiCarte(false);
      if (erreur) { onErreur?.("Note non enregistrée"); return; }
      setTexte("");
      void triggerHaptic("Light");
      void invaliderTableauBlanc(queryClient);
      return;
    }
    try {
      await ajouter.mutateAsync({ athleteId, content: contenu });
      setTexte("");
      void triggerHaptic("Light");
    } catch {
      onErreur?.("Note non enregistrée");
    }
  };

  const supprimer = async (id: string) => {
    setASupprimer(null);
    const { error } = await createClient().from(surCarte ? "cartes_prospect_notes" : "recruiter_notes").delete().eq("id", id);
    if (error) onErreur?.("Note non supprimée");
    void invaliderTableauBlanc(queryClient);
  };

  return (
    <div data-testid="fil-notes-suivi-mobile">
      <button
        type="button"
        onClick={() => { void triggerHaptic("Light"); setOuvert((o) => !o); }}
        aria-expanded={ouvert}
        data-testid="notes-bascule"
        className="w-full min-h-[44px] flex items-center justify-between text-left"
      >
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF] font-bold">
          {titre} ({chargement ? "…" : notes.length})
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: ouvert ? "rotate(180deg)" : undefined, transition: "transform 150ms" }} aria-hidden>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {ouvert && (<>
      {!lectureSeule && (
        <div className="flex gap-2">
          <input
            type="text"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Ajouter une note…"
            aria-label="Ajouter une note de suivi"
            className="flex-1 px-3 py-2.5 bg-[#0C0E12] rounded-2xl text-[16px] text-white placeholder:text-[#4a4d56] border border-white/[0.06] outline-none focus:border-[#E63946]/40"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void poster(); } }}
          />
          <button
            type="button"
            onClick={() => void poster()}
            disabled={!texte.trim() || enCours}
            className={`min-h-[44px] px-4 rounded-2xl text-[11px] uppercase tracking-wider font-bold transition-colors ${
              texte.trim() && !enCours ? "bg-[#E63946] text-white active:bg-[#D42B22]" : "bg-white/[0.06] text-[#4a4d56]"
            }`}
          >
            {enCours ? "…" : "Poster"}
          </button>
        </div>
      )}

      <div className="mt-3">
        {chargement ? (
          <div className="space-y-2.5">
            <div className="pl-3 border-l-2 border-white/[0.06]">
              <div className="h-3 rounded nx-pulse-skel-pl" style={{ width: "85%" }} />
              <div className="h-2.5 mt-1 rounded nx-pulse-skel-pl" style={{ width: "30%" }} />
            </div>
          </div>
        ) : notes.length === 0 ? (
          <p className="text-[12px] text-[#4a4d56] italic">Aucune note de suivi.</p>
        ) : (
          <div className="space-y-3">
            {notes.map((n) => {
              const aMoi = !!moi && n.recruiter_id === moi;
              const d = new Date(n.created_at);
              const date = d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
              const heure = d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
              return (
                <div key={n.id} className={`pl-3 border-l-2 ${aMoi ? "border-[#E63946]/40" : "border-white/[0.12]"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] text-[#9CA3AF]">
                      {signature(n.recruiter_id) && <span className="text-white font-semibold">{signature(n.recruiter_id)} · </span>}
                      {date} · {heure}
                    </p>
                    {aMoi && !lectureSeule && aSupprimer !== n.id && (
                      <button
                        type="button"
                        onClick={() => setASupprimer(n.id)}
                        aria-label="Supprimer cette note"
                        className="-mt-2 -mr-2 w-9 h-9 flex items-center justify-center text-[#6b7280] active:text-[#EF4444]"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                  <p className="text-[13px] text-[#e0e0e0] leading-relaxed whitespace-pre-wrap mt-0.5">{n.content}</p>
                  {aSupprimer === n.id && (
                    <div className="flex items-center gap-4 mt-1.5">
                      <span className="text-[12px] text-[#9CA3AF]">Supprimer cette note ?</span>
                      <button type="button" onClick={() => void supprimer(n.id)} className="min-h-[36px] text-[12px] font-bold text-[#EF4444]">Supprimer</button>
                      <button type="button" onClick={() => setASupprimer(null)} className="min-h-[36px] text-[12px] font-bold text-[#6b7280]">Annuler</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}
