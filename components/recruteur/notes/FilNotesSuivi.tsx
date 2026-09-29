"use client";

/* ═══════════════════════════════════════════════════════════════
   FilNotesSuivi — LE fil de notes d'un joueur (retour BP, lot C).

   UN SEUL FIL PAR JOUEUR, UN SEUL COMPOSANT. Partout où un fil de notes
   s'ouvre — panneau de Mon processus, panneau d'une liste — c'est celui-ci,
   sur la même table :
     · athlète Nexus  → recruiter_notes, celles de l'UNITÉ (RLS), signées ;
     · carte prospect → cartes_prospect_notes, le fil de la carte.
   Les notes des collègues se lisent sans se modifier ni se supprimer ; les
   siennes se suppriment (la RLS en décide aussi).

   `lecture="siennes"` (recruteur sans unité) : ses propres notes seulement
   (usePipelineNotes, partagé avec le mobile). `bloque` (mode démo gratuit) :
   « Poster » ouvre l'offre Pro — la RLS refuserait l'écriture.

   Toute écriture relit le tableau blanc (invaliderTableauBlanc) : la colonne
   « Note de suivi », l'Historique et l'autre panneau suivent.
═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useNotesUnite, useAuteursUnite, nomAuteur } from "@/lib/queries/recruiter/useProcessusUnite";
import { usePipelineNotes } from "@/lib/queries/recruiter/usePipelineNotes";
import { useNotesCarte } from "@/lib/cartes/useCartes";
import { ajouterNoteCarte } from "@/lib/cartes/carteProspect";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";

export interface SujetNotes {
  type: "athlete" | "carte";
  id: string;
}

interface Note { id: string; content: string; created_at: string; recruiter_id?: string }

export default function FilNotesSuivi({
  sujet,
  lecture = "unite",
  bloque = false,
  lectureSeule = false,
  onTease,
  onErreur,
  titre = "Notes de suivi",
}: {
  sujet: SujetNotes;
  lecture?: "unite" | "siennes";
  /** Mode démo gratuit : « Poster » ouvre l'offre Pro au lieu d'écrire. */
  bloque?: boolean;
  /** Aucun champ (dossier d'une autre unité lu par l'admin cégep). */
  lectureSeule?: boolean;
  onTease?: () => void;
  onErreur?: (message: string) => void;
  titre?: string;
}) {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const moi = currentUser?.authUser.id ?? null;
  const carte = sujet.type === "carte";
  const demo = lecture === "siennes" && !carte;

  const { data: notesUnite = [] } = useNotesUnite(!carte && !demo ? sujet.id : null);
  const { data: notesDemo = [] } = usePipelineNotes(demo ? sujet.id : null);
  const { data: notesCarte = [] } = useNotesCarte(carte ? sujet.id : null);
  const { data: auteurs = {} } = useAuteursUnite(!demo);
  const notes: Note[] = carte ? notesCarte : demo ? notesDemo.map((n) => ({ ...n, recruiter_id: moi ?? undefined })) : notesUnite;

  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);

  const signature = (id: string | undefined) => (!id ? null : id === moi ? "Moi" : nomAuteur(auteurs[id]));

  const poster = async () => {
    const contenu = texte.trim();
    if (!contenu || envoi) return;
    if (bloque) { onTease?.(); setTexte(""); return; }
    if (!moi) return;
    setEnvoi(true);
    const supabase = createClient();
    const error = carte
      ? await ajouterNoteCarte(supabase, sujet.id, contenu)
      : (await supabase.from("recruiter_notes").insert({ recruiter_id: moi, athlete_id: sujet.id, content: contenu })).error;
    setEnvoi(false);
    if (error) { onErreur?.("Note non enregistrée"); return; }
    setTexte("");
    void invaliderTableauBlanc(queryClient);
  };

  const supprimer = async (id: string) => {
    setASupprimer(null);
    const { error } = await createClient().from(carte ? "cartes_prospect_notes" : "recruiter_notes").delete().eq("id", id);
    if (error) onErreur?.("Note non supprimée");
    void invaliderTableauBlanc(queryClient);
  };

  return (
    <div data-testid="fil-notes-suivi">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">{titre}</h3>
        {notes.length > 0 && <span className="text-[10px] text-[#4a4d56]">{notes.length}</span>}
      </div>

      {!lectureSeule && (
        <div className="flex gap-2">
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={2}
            placeholder="Ajouter une note..."
            aria-label="Ajouter une note de suivi"
            className="flex-1 bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors resize-none"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void poster(); } }}
          />
          <button
            type="button"
            onClick={() => void poster()}
            disabled={envoi || !texte.trim()}
            className="self-end px-3 py-2 bg-[#E63946] hover:bg-[#D42B22] disabled:bg-[#2D3748] disabled:text-[#4a4d56] text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors shrink-0"
          >
            {envoi ? "..." : "Poster"}
          </button>
        </div>
      )}

      {notes.length === 0 ? (
        <p className="text-[12px] text-[#4a4d56] italic mt-3">Aucune note de suivi.</p>
      ) : (
        <div className="mt-4">
          {notes.map((note, idx) => {
            const d = new Date(note.created_at);
            const dateStr = d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
            const timeStr = d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
            const aMoi = !!moi && note.recruiter_id === moi && !demo;
            return (
              <div key={note.id} className={`group relative pl-5 pb-4 ml-1.5 ${idx < notes.length - 1 ? "border-l border-[#2D3748]" : "border-l border-transparent"}`}>
                <div className="absolute left-[-4px] top-1 w-2 h-2 rounded-full bg-[#E63946]" />
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-[11px] font-bold text-[#9CA3AF]">
                    {signature(note.recruiter_id) && <span className="text-white">{signature(note.recruiter_id)} · </span>}
                    {dateStr}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-[#4a4d56]">{timeStr}</span>
                    {aMoi && !lectureSeule && aSupprimer !== note.id && (
                      <button type="button" onClick={() => setASupprimer(note.id)} aria-label="Supprimer cette note"
                        className="text-[#6b7280] hover:text-[#EF4444] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                      </button>
                    )}
                  </span>
                </div>
                <p className="text-[13px] text-[#e0e0e0] leading-relaxed whitespace-pre-wrap">{note.content}</p>
                {aSupprimer === note.id && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] text-[#9CA3AF]">Supprimer cette note ?</span>
                    <button type="button" onClick={() => void supprimer(note.id)} className="text-[11px] font-bold text-[#EF4444]">Supprimer</button>
                    <button type="button" onClick={() => setASupprimer(null)} className="text-[11px] font-bold text-[#6b7280] hover:text-white">Annuler</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
