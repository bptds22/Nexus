"use client";

/* ═══════════════════════════════════════════════════════════════
   Admin — inscriptions par campagne (attribution UTM first-party).
   Lecture seule, COMPTES seulement : aucune donnée personnelle ne quitte
   la base. La RPC admin_inscriptions_par_campagne (is_admin()) agrège
   users × inscription_attribution sur 7 ou 30 jours ; la page ne fait
   qu'afficher. Usage : dépense Meta ÷ inscriptions d'une campagne.
   Plan et DDL : docs/attribution-utm-plan.md.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Fenetre = 7 | 30;

interface Ligne {
  campagne: string | null;
  source: string | null;
  athletes: number;
  coachs: number;
  recruteurs: number;
  parents: number;
  total: number;
}

const COLONNES = [
  { cle: "athletes", titre: "Athlètes" },
  { cle: "coachs", titre: "Coachs" },
  { cle: "recruteurs", titre: "Recruteurs" },
  { cle: "parents", titre: "Parents" },
  { cle: "total", titre: "Total" },
] as const;

export default function AdminCampagnesPage() {
  const [jours, setJours] = useState<Fenetre>(30);
  // Chargé pour quelle fenêtre : « chargement » se déduit, sans setState
  // synchrone dans l'effet.
  const [resultat, setResultat] = useState<{ jours: Fenetre; lignes: Ligne[]; erreur: string | null } | null>(null);

  useEffect(() => {
    let annule = false;
    // RPC absente des types générés tant que la migration n'est pas appliquée.
    const rpc = createClient().rpc as unknown as (
      f: string, a: Record<string, unknown>,
    ) => Promise<{ data: Ligne[] | null; error: { message: string } | null }>;
    void rpc("admin_inscriptions_par_campagne", { p_jours: jours }).then(({ data, error }) => {
      if (annule) return;
      setResultat({
        jours,
        lignes: (data ?? []).map((l) => ({
          ...l,
          athletes: Number(l.athletes), coachs: Number(l.coachs), recruteurs: Number(l.recruteurs),
          parents: Number(l.parents), total: Number(l.total),
        })),
        erreur: error ? "Lecture impossible (la migration d'attribution est-elle appliquée ?)." : null,
      });
    });
    return () => { annule = true; };
  }, [jours]);

  const chargement = resultat?.jours !== jours;
  const lignes = useMemo(() => (chargement ? [] : resultat?.lignes ?? []), [chargement, resultat]);
  const totaux = useMemo(() => lignes.reduce(
    (t, l) => ({
      athletes: t.athletes + l.athletes, coachs: t.coachs + l.coachs, recruteurs: t.recruteurs + l.recruteurs,
      parents: t.parents + l.parents, total: t.total + l.total,
    }),
    { athletes: 0, coachs: 0, recruteurs: 0, parents: 0, total: 0 },
  ), [lignes]);

  const bouton = (actif: boolean) =>
    `px-3 py-1.5 rounded-lg text-[13px] font-semibold border transition-colors ${
      actif ? "bg-[#E63946] border-[#E63946] text-white" : "bg-[#1A1D24] border-[#2D3748] text-[#9CA3AF] hover:text-white"
    }`;

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Inscriptions par campagne</h1>
          <p className="text-[13px] text-[#9CA3AF] mt-1">
            Comptes créés sur la période, par campagne et source (UTM de l&apos;URL d&apos;arrivée). Comptes seulement.
          </p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Période">
          {([7, 30] as const).map((j) => (
            <button key={j} type="button" aria-pressed={jours === j} onClick={() => setJours(j)} className={bouton(jours === j)}>
              {j} derniers jours
            </button>
          ))}
        </div>
      </div>

      {resultat?.erreur && !chargement && <p role="alert" className="text-[13px] text-[#FCA5A5] mb-4">{resultat.erreur}</p>}
      {chargement ? (
        <p className="text-[13px] text-[#6b7280]">Chargement…</p>
      ) : lignes.length === 0 ? (
        !resultat?.erreur && <p className="text-[13px] text-[#6b7280]">Aucune inscription sur la période.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#2D3748]">
          <table className="w-full text-[13px]">
            <thead className="bg-[#1A1D24] text-[11px] uppercase tracking-wider text-[#6b7280]">
              <tr>
                <th className="text-left font-bold px-3 py-2.5">Campagne</th>
                <th className="text-left font-bold px-3 py-2.5">Source</th>
                {COLONNES.map((c) => <th key={c.cle} className="text-right font-bold px-3 py-2.5">{c.titre}</th>)}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={`${l.campagne ?? ""}|${l.source ?? ""}`} className="border-t border-[#2D3748] text-[#E5E7EB]">
                  <td className="px-3 py-2.5 text-white font-semibold">{l.campagne ?? <span className="text-[#6b7280] font-normal">(sans campagne)</span>}</td>
                  <td className="px-3 py-2.5">{l.source ?? <span className="text-[#6b7280]">—</span>}</td>
                  {COLONNES.map((c) => (
                    <td key={c.cle} className={`px-3 py-2.5 text-right tabular-nums ${c.cle === "total" ? "text-white font-semibold" : ""}`}>{l[c.cle]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-[#2D3748] bg-[#1A1D24] text-white font-semibold">
              <tr>
                <td className="px-3 py-2.5" colSpan={2}>Total</td>
                {COLONNES.map((c) => <td key={c.cle} className="px-3 py-2.5 text-right tabular-nums">{totaux[c.cle]}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
