"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import { createClient } from "@/lib/supabase/client";
import BlackoutForm, { type BlackoutRow, type SportOption } from "../_components/BlackoutForm";
import { describeBlackout, estEnCours, todayMontrealIso } from "../_components/describeBlackout";

/* ═══════════════════════════════════════════════════════════════
   Admin — édition d'une période de silence.

   Le garde is_platform_admin vient de app/admin/layout.tsx. Le formulaire
   est le MÊME composant que la création : une seule définition des champs
   et de leurs règles, donc pas de dérive entre les deux écrans.

   La phrase est rappelée AU-DESSUS du formulaire et se recalcule à chaque
   enregistrement : on relit la règle telle qu'elle s'appliquera, pas les
   champs qu'on vient de taper.
═══════════════════════════════════════════════════════════════ */

export default function PageClient() {
  const id = useDynamicParam("id");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [row, setRow] = useState<BlackoutRow | null>(null);
  const [sports, setSports] = useState<SportOption[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "not-found">("loading");
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    if (!id || id === "placeholder") return;
    const [bRes, sRes] = await Promise.all([
      supabase
        .from("blackout_periods")
        .select("id, libelle, sport_id, promo_min, promo_max, date_debut, date_fin, actif")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("sports").select("id, nom").order("nom"),
    ]);
    setSports((sRes.data ?? []) as SportOption[]);
    if (!bRes.data) { setState("not-found"); return; }
    setRow(bRes.data as BlackoutRow);
    setState("ready");
  }, [id, supabase]);

  useEffect(() => { void load(); }, [load]);

  if (state === "loading") {
    return <div className="px-6 sm:px-10 py-8 max-w-[900px] mx-auto text-[13px] text-[#6b7280]">Chargement…</div>;
  }

  if (state === "not-found" || !row) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[900px] mx-auto">
        <p className="text-[14px] text-white font-semibold">Période introuvable</p>
        <p className="text-[13px] text-[#9CA3AF] mt-1.5">
          Elle a peut-être été retirée depuis une autre session.
        </p>
        <Link href="/admin/blackouts" className="text-[13px] text-[#E63946] hover:underline mt-3 inline-block">
          ← Retour aux périodes
        </Link>
      </div>
    );
  }

  const sportNom = sports.find((s) => s.id === row.sport_id)?.nom ?? null;
  const active = estEnCours(row, todayMontrealIso());

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[900px] mx-auto">
      <Link href="/admin/blackouts"
        className="text-[12px] font-bold uppercase tracking-wider text-[#E63946] hover:text-white transition-colors">
        ← Périodes de silence
      </Link>

      <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight mt-4">
        {row.libelle}
      </h1>

      {/* La règle telle qu'elle s'applique, avant les champs. */}
      <div className={`mt-4 rounded-xl border px-5 py-4 ${
        active ? "bg-[#E63946]/10 border-[#E63946]/30" : "bg-[#1A1D24] border-white/10"
      }`}>
        {active && (
          <p className="text-[11px] font-black uppercase tracking-wider text-[#E63946] mb-1.5">
            En cours aujourd&apos;hui
          </p>
        )}
        <p className="text-[13px] text-white leading-relaxed">
          {describeBlackout(row, sportNom)}
        </p>
        {!row.actif && (
          <p className="text-[12px] text-[#6b7280] mt-2">
            Cette période est désarmée : elle ne bloque rien, et reste conservée comme trace.
          </p>
        )}
      </div>

      <div className="mt-6">
        <BlackoutForm
          initial={row}
          sports={sports}
          onSaved={() => { notify("Période enregistrée"); void load(); }}
          onCancel={() => router.push("/admin/blackouts")}
        />
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#1A1D24] border border-[#2D3748] rounded-lg px-4 py-3 text-[13px] text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
