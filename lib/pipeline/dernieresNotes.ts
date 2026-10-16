/* ═══════════════════════════════════════════════════════════════
   dernieresNotes — la colonne « Note de suivi » de Mon processus
   (correctif 2026-10-16, décision BP : l'expérience client d'abord).

   Les cartes s'affichent DÈS qu'elles sont lues ; les dernières notes
   arrivent par une seconde lecture (processus_dernieres_notes), lancée en
   même temps. Ce module pose sur chaque carte l'une de trois situations :
     · notes reçues        → derniere_note = la note (ou null : aucune note) ;
     · notes en chargement → derniere_note_etat = "chargement" (indicateur
       discret à l'écran, JAMAIS une note vide) ;
     · notes en erreur     → derniere_note_etat = "erreur" (l'écran le dit,
       avec « Réessayer »).
   Pur : aucune lecture, testable sans réseau.
═══════════════════════════════════════════════════════════════ */

import type { PipelineKanbanCard } from "@/app/recruteur/pipeline/_data/mockKanbanData";
import type { DerniereNote } from "@/lib/cartes/carteProspect";

export interface NotesProcessus {
  cartes: Record<string, DerniereNote>;
  dossiers: Record<string, DerniereNote>;
}

export type EtatNotes = "pret" | "chargement" | "erreur";

/** Carte prospect ? (le champ `carte` la distingue — même test que estCarte,
 *  sans importer le module des cartes dans ce module pur). */
function estCarteProspect(c: PipelineKanbanCard): boolean {
  return !!(c as { carte?: unknown }).carte;
}

/**
 * Pose la dernière note (ou l'état de sa lecture) sur chaque carte.
 * Clé : `pipeline_id` — l'athlète pour un dossier, la carte pour une carte
 * prospect (useProcessusUnite / versKanban).
 */
export function appliquerDernieresNotes(
  cards: PipelineKanbanCard[],
  notes: NotesProcessus | undefined,
  etat: EtatNotes,
  nomAuteur: (id: string | null) => string,
): PipelineKanbanCard[] {
  if (!notes) {
    // Pas encore de notes (ou erreur sans notes déjà reçues) : on ne pose
    // RIEN qui ressemble à « aucune note ».
    const marque = etat === "erreur" ? "erreur" : "chargement";
    return cards.map((c) => ({ ...c, derniere_note: undefined, derniere_note_etat: marque }));
  }
  return cards.map((c) => {
    const n = (estCarteProspect(c) ? notes.cartes : notes.dossiers)[c.pipeline_id];
    return {
      ...c,
      derniere_note: n ? { content: n.content, created_at: n.created_at, auteur: nomAuteur(n.auteur) } : null,
      // Des notes déjà reçues restent affichées pendant un rechargement ou
      // après l'échec d'un rechargement : pas de marque sur la cellule.
      derniere_note_etat: undefined,
    };
  });
}

/* ── Export Excel : toutes les notes de chaque ligne ─────────────────
   Réponse de processus_notes_export, déjà triée du plus ancien au plus
   récent. Une case par ligne : « date — Auteur — texte », une note par
   ligne de la case (multiligne natif d'Excel). */
export interface NoteExport { id: string; content: string; created_at: string; auteur: string | null }
export interface NotesExport { dossiers: NoteExport[] | null; cartes: NoteExport[] | null }

export function notesParLigne(
  notes: NotesExport,
  nomAuteur: (id: string | null) => string,
  date: (iso: string) => string,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const n of [...(notes.dossiers ?? []), ...(notes.cartes ?? [])]) {
    (out[n.id] ??= []).push(`${date(n.created_at)} — ${nomAuteur(n.auteur)} — ${n.content}`);
  }
  return out;
}
