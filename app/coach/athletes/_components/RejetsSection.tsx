"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   RejetsSection — les rattachements rejetés, et le chemin du retour.

   POURQUOI CETTE SECTION EXISTE : un athlète rejeté a `school_id`
   NULL, et plus aucune policy ne laisse le personnel de l'école le
   lire. Il disparaît de tous les écrans. Sans cette liste, la
   fenêtre d'annulation ILLIMITÉE décidée par BP n'existerait que si
   l'athlète revenait de lui-même par une équipe — c'est-à-dire pas.

   `list_school_rejections()` est un SECURITY DEFINER : il franchit la
   RLS et borne lui-même à l'école dont on est directeur. Un directeur
   d'une autre école reçoit zéro ligne (prouvé par exécution).

   Elle ne dit PAS où l'athlète s'est rattaché depuis, seulement QUE
   c'est arrivé. Nommer la nouvelle école rendrait à un établissement
   qui vient de désavouer ce jeune une information qu'il n'a plus le
   droit de lire.
═══════════════════════════════════════════════════════════════ */

interface RejetLigne {
  rejection_id: string;
  athlete_id: string;
  first_name: string | null;
  last_name: string | null;
  rejected_at: string;
  rejected_by: string | null;
  rejected_by_nom: string | null;
  /** L'athlète s'est rattaché à un établissement depuis : l'annulation
   *  écraserait sa déclaration, la RPC la refuse. */
  reattache: boolean;
}

const dateFr = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
};

export default function RejetsSection({ onCancelSuccess }: { onCancelSuccess?: () => void }) {
  const [lignes, setLignes] = useState<RejetLigne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  /* `lire` RETOURNE les lignes au lieu de poser l'état : l'effet les pose dans
     un callback, jamais dans son corps (cascade de rendus), et le drapeau
     `annule` évite d'écrire dans un composant démonté. */
  const lire = useCallback(async (): Promise<RejetLigne[]> => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("list_school_rejections");
    if (error) {
      console.error("[list_school_rejections]", error);
      return [];
    }
    return (data ?? []) as RejetLigne[];
  }, []);

  useEffect(() => {
    let annule = false;
    lire().then((rows) => {
      if (annule) return;
      setLignes(rows);
      setChargement(false);
    });
    return () => { annule = true; };
  }, [lire]);

  async function annuler(ligne: RejetLigne) {
    if (enCours) return;
    setEnCours(ligne.rejection_id);
    setErreur(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("cancel_school_rejection", { p_athlete_id: ligne.athlete_id });
    setEnCours(null);

    if (error) {
      /* Le refus de la garde est une INFORMATION, pas un échec technique : on
         le rend tel quel, débarrassé du préfixe de marqueur. */
      console.error("[cancel_school_rejection]", error);
      setErreur(error.message?.replace(/^NEXUS:\s*/, "") || "Impossible d'annuler ce rejet.");
      // On relit : si le refus vient de la garde, la ligne porte désormais
      // `reattache` et l'écran le dira sans qu'on ait à recliquer.
      setLignes(await lire());
      return;
    }

    setLignes(await lire());
    onCancelSuccess?.();
  }

  // Rien à montrer : pas de section vide qui pose une question sans objet.
  if (chargement || lignes.length === 0) return null;

  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
      <h3 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1 flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        Rattachements rejetés ({lignes.length})
      </h3>
      <p className="text-[12.5px] text-[#9CA3AF] mb-4 leading-relaxed">
        Ces athlètes ne sont plus rattachés à ton établissement et ont été prévenus.
        Un rejet posé par erreur s&apos;annule ici, sans limite de temps.
      </p>

      {erreur && (
        <p className="mb-3 text-[12.5px] text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/25 rounded-lg px-3 py-2">
          {erreur}
        </p>
      )}

      <div className="space-y-2">
        {lignes.map((l) => {
          const nom = `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || "Athlète";
          return (
            <div
              key={l.rejection_id}
              className="flex items-center justify-between gap-4 bg-[#13151a] rounded-lg border border-[#2D3748] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-white truncate">{nom}</p>
                <p className="text-[12px] text-[#6b7280] mt-0.5">
                  Rejeté le {dateFr(l.rejected_at)}
                  {l.rejected_by_nom ? ` par ${l.rejected_by_nom}` : ""}
                </p>
              </div>

              {l.reattache ? (
                /* La garde de la RPC refuserait de toute façon ; on le dit
                   AVANT le clic plutôt que de laisser l'erreur l'apprendre. */
                <p className="text-[12px] text-[#9CA3AF] text-right shrink-0 max-w-[46%] leading-snug">
                  S&apos;est rattaché à un établissement depuis —
                  l&apos;annulation n&apos;est plus possible.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => annuler(l)}
                  disabled={enCours === l.rejection_id}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-[#2D3748] text-[12px] font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-white hover:border-[#22C55E]/50 hover:bg-[#22C55E]/10 transition-colors disabled:opacity-40"
                >
                  {enCours === l.rejection_id ? "..." : "Annuler le rejet"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
