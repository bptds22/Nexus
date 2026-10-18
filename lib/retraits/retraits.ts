/* ═══════════════════════════════════════════════════════════════
   retraits — « Retiré » ne supprime plus rien (BP 2026-10-18).

   Retirer un dossier (athlète ou carte prospect) le place à l'étape
   RETIRE, en fin de processus, avec une RAISON obligatoire et une note :
   le dossier reste visible à l'unité, personne ne le recrute deux fois.
   Base : migration 20261018140000 (unite_retirer, carte_retirer,
   unite_retraits). Logique pure + les deux appels, web et appli.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

export type RaisonRetrait = "PAS_INTERESSE" | "NIVEAU" | "AUTRE";

export const RAISONS_RETRAIT: readonly { code: RaisonRetrait; libelle: string; aide: string }[] = [
  { code: "PAS_INTERESSE", libelle: "Pas intéressé", aide: "L'athlète n'est pas intéressé" },
  { code: "NIVEAU", libelle: "Pas le niveau", aide: "Pas le niveau recherché" },
  { code: "AUTRE", libelle: "Autre", aide: "Précise dans la note" },
];

export const NOTE_RETRAIT_MAX = 500;

export function libelleRaison(code: string | null | undefined): string {
  return RAISONS_RETRAIT.find((r) => r.code === code)?.libelle ?? "Retiré";
}

export function estRaison(v: unknown): v is RaisonRetrait {
  return typeof v === "string" && RAISONS_RETRAIT.some((r) => r.code === v);
}

/** Une raison lue en base (unite_retraits). */
export interface Retrait {
  athleteId: string | null;
  carteId: string | null;
  raison: string;
  note: string | null;
  retireParNom: string | null;
  retireLe: string;
}

/** Clé de fusion : un athlète et une carte peuvent porter le même identifiant de forme. */
export const cleRetrait = (id: string, carte: boolean) => `${carte ? "c" : "a"}:${id}`;

export function versRetraits(rows: readonly Record<string, unknown>[] | null | undefined): Map<string, Retrait> {
  const m = new Map<string, Retrait>();
  for (const r of rows ?? []) {
    const athleteId = (r.athlete_id as string | null) ?? null;
    const carteId = (r.carte_id as string | null) ?? null;
    const id = carteId ?? athleteId;
    if (!id) continue;
    m.set(cleRetrait(id, !!carteId), {
      athleteId, carteId,
      raison: String(r.raison ?? ""),
      note: (r.note as string | null) ?? null,
      retireParNom: (r.retire_par_nom as string | null) ?? null,
      retireLe: String(r.retire_le ?? ""),
    });
  }
  return m;
}

/** « 18 oct. » (fr-CA), vide si la date est illisible. */
export function dateCourte(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}

/** « Pas le niveau · Pas assez rapide pour le D1 · par Julie, 18 oct. » */
export function resumeRetrait(r: Pick<Retrait, "raison" | "note" | "retireParNom" | "retireLe">): string {
  const par = [r.retireParNom?.trim() ? `par ${r.retireParNom.trim()}` : "", dateCourte(r.retireLe)].filter(Boolean).join(", ");
  return [libelleRaison(r.raison), r.note?.trim() || "", par].filter(Boolean).join(" · ");
}

/** La fonction serveur n'existe pas (prod sans la migration). */
export function fonctionAbsente(e: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!e) return false;
  return e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? "");
}

export const MESSAGE_MISE_A_JOUR = "Mise à jour requise côté serveur : le retrait n'est pas encore disponible.";

/** Message à l'écran : le refus « NEXUS: » sans son préfixe ; fonction absente → mise à jour requise. */
export function messageRetrait(e: { code?: string | null; message?: string | null } | null | undefined): string {
  if (fonctionAbsente(e)) return MESSAGE_MISE_A_JOUR;
  const m = e?.message ?? "";
  const i = m.indexOf("NEXUS:");
  return i >= 0 ? m.slice(i + 6).trim() : "Le retrait n'a pas pu être enregistré. Réessaie.";
}

export interface DemandeRetrait {
  id: string;
  carte: boolean;
  /** unite_sport_id du dossier (athlète) ; ignoré pour une carte. */
  sportId?: string | null;
  raison: RaisonRetrait;
  note?: string | null;
}

/** Retire SANS supprimer : unite_retirer (athlète) ou carte_retirer (carte). Jamais de repli sur la suppression. */
export async function retirerDossier(supabase: SupabaseClient, d: DemandeRetrait): Promise<{ code?: string; message: string } | null> {
  const note = (d.note ?? "").trim().slice(0, NOTE_RETRAIT_MAX) || null;
  const { error } = d.carte
    ? await supabase.rpc("carte_retirer", { p_carte_id: d.id, p_raison: d.raison, p_note: note })
    : await supabase.rpc("unite_retirer", { p_athlete_id: d.id, p_sport_id: d.sportId ?? null, p_raison: d.raison, p_note: note });
  if (error) {
    console.error(`[retrait] ${error.code ?? ""} ${error.message}`);
    return { code: error.code, message: error.message };
  }
  return null;
}
