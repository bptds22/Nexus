"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BlackoutForm, { type BlackoutRow, type SportOption } from "./_components/BlackoutForm";
import { describeBlackout, estEnCours, estAVenir, todayMontrealIso } from "./_components/describeBlackout";

/* ═══════════════════════════════════════════════════════════════
   Admin — Périodes de silence RSEQ.

   Le garde is_platform_admin est déjà posé par app/admin/layout.tsx
   (composant serveur, redirection avant tout montage). Aucun garde
   supplémentaire ici : ce serait une seconde source de vérité pour la
   même règle, et c'est le même drapeau que la policy « blackout admin
   write » exige côté base.

   PAS D'AdminTable ICI, DÉLIBÉRÉMENT. AdminTable édite des champs en
   place, colonne par colonne — parfait pour une table de référence, faux
   pour une RÈGLE. Une période se relit comme une phrase : c'est ainsi
   qu'une fourchette de promotions à l'envers ou un sport oublié se
   repèrent. La liste rend donc des phrases, et l'édition se fait dans un
   formulaire complet où les champs se contraignent mutuellement.
═══════════════════════════════════════════════════════════════ */

export default function AdminBlackoutsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<BlackoutRow[]>([]);
  const [sports, setSports] = useState<SportOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const today = todayMontrealIso();

  const notify = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [bRes, sRes] = await Promise.all([
      supabase
        .from("blackout_periods")
        .select("id, libelle, sport_id, promo_min, promo_max, date_debut, date_fin, actif")
        /* Tri demandé : armées d'abord, puis par date de début. Descendant
           sur la date — sur un calendrier réglementaire, ce qui vient de
           commencer ou va commencer prime sur ce qui est clos. */
        .order("actif", { ascending: false })
        .order("date_debut", { ascending: false }),
      supabase.from("sports").select("id, nom").order("nom"),
    ]);
    setRows((bRes.data ?? []) as BlackoutRow[]);
    setSports((sRes.data ?? []) as SportOption[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const sportNomById = useMemo(
    () => new Map(sports.map((s) => [s.id, s.nom])),
    [sports],
  );

  /* Désarmer, jamais supprimer. Une période passée explique après coup
     pourquoi un contact avait été refusé ; l'effacer perdrait cette trace. */
  async function toggleActif(row: BlackoutRow) {
    const { error } = await supabase
      .from("blackout_periods")
      .update({ actif: !row.actif, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) { notify(`Erreur : ${error.message}`); return; }
    notify(row.actif ? "Période désarmée" : "Période armée");
    void fetchAll();
  }

  const enCours = rows.filter((r) => estEnCours(r, today));

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
            Périodes de silence
          </h1>
          <p className="text-[14px] text-[#9CA3AF] mt-1">
            Pendant une période armée, un recruteur ne peut pas écrire aux athlètes visés.
            Il garde le droit de parler à leur entraîneur.
          </p>
        </div>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)}
            className="shrink-0 px-4 py-2.5 rounded-lg bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors">
            Nouvelle période
          </button>
        )}
      </div>

      {/* L'information qui compte à l'ouverture : y a-t-il un silence en
          vigueur maintenant ? Elle est donnée avant la liste, pas dedans. */}
      <div className={`mt-6 rounded-xl border px-5 py-4 ${
        enCours.length > 0
          ? "bg-[#E63946]/10 border-[#E63946]/30"
          : "bg-[#1A1D24] border-white/10"
      }`}>
        {enCours.length > 0 ? (
          <>
            <p className="text-[13px] font-bold text-[#E63946] uppercase tracking-wider">
              {enCours.length === 1 ? "Une période est en cours" : `${enCours.length} périodes sont en cours`}
            </p>
            <ul className="mt-2 space-y-1">
              {enCours.map((r) => (
                <li key={r.id} className="text-[13px] text-white leading-relaxed">
                  {describeBlackout(r, sportNomById.get(r.sport_id ?? "") ?? null)}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-[13px] text-[#9CA3AF]">
            Aucune période en vigueur aujourd&apos;hui. Les recruteurs peuvent écrire normalement.
          </p>
        )}
      </div>

      {creating && (
        <div className="mt-6">
          <BlackoutForm
            sports={sports}
            onSaved={() => { setCreating(false); notify("Période créée"); void fetchAll(); }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      <div className="mt-8 space-y-3">
        {loading ? (
          <p className="text-[13px] text-[#6b7280]">Chargement…</p>
        ) : rows.length === 0 ? (
          <div className="bg-[#1A1D24] border border-white/10 rounded-xl px-5 py-8 text-center">
            <p className="text-[14px] text-white font-semibold">Aucune période enregistrée</p>
            <p className="text-[13px] text-[#9CA3AF] mt-1.5">
              Tant que cette liste est vide, aucun contact n&apos;est bloqué.
            </p>
          </div>
        ) : (
          rows.map((r) => {
            const nom = sportNomById.get(r.sport_id ?? "") ?? null;
            const active = estEnCours(r, today);
            const aVenir = estAVenir(r, today);
            return (
              <div key={r.id}
                className={`rounded-xl border px-5 py-4 transition-colors ${
                  active ? "bg-[#1A1D24] border-[#E63946]/40" : "bg-[#1A1D24] border-white/10"
                }`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-semibold text-white">{r.libelle}</span>
                      {active && (
                        <span className="px-2 py-0.5 rounded-full bg-[#E63946] text-white text-[10px] font-black uppercase tracking-wider">
                          En cours
                        </span>
                      )}
                      {aVenir && (
                        <span className="px-2 py-0.5 rounded-full bg-[#3B82F6]/15 text-[#3B82F6] text-[10px] font-black uppercase tracking-wider">
                          À venir
                        </span>
                      )}
                      {!r.actif && (
                        <span className="px-2 py-0.5 rounded-full bg-white/5 text-[#6b7280] text-[10px] font-black uppercase tracking-wider">
                          Désarmée
                        </span>
                      )}
                    </div>
                    <p className={`text-[13px] leading-relaxed mt-1.5 ${r.actif ? "text-[#9CA3AF]" : "text-[#6b7280]"}`}>
                      {describeBlackout(r, nom)}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <button type="button" onClick={() => { void toggleActif(r); }}
                      className="px-3 py-1.5 rounded-lg border border-[#2D3748] text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-white transition-colors">
                      {r.actif ? "Désarmer" : "Armer"}
                    </button>
                    <Link href={`/admin/blackouts/${r.id}`}
                      className="px-3 py-1.5 rounded-lg border border-[#2D3748] text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-white transition-colors">
                      Modifier
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#1A1D24] border border-[#2D3748] rounded-lg px-4 py-3 text-[13px] text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
