"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   BlackoutForm — création ET édition d'une période de silence RSEQ.

   Partagé par la liste (création en place) et la page [id] (édition),
   pour qu'il n'existe qu'une seule définition des champs et des règles.
   Deux formulaires jumeaux auraient dérivé.

   AUCUNE SUPPRESSION. On désarme (`actif = false`), jamais on ne supprime :
   une décision de ligue laisse une trace, et une période passée explique
   après coup pourquoi un contact avait été refusé.
═══════════════════════════════════════════════════════════════ */

export interface BlackoutRow {
  id: string;
  libelle: string;
  sport_id: string | null;
  promo_min: number | null;
  promo_max: number | null;
  date_debut: string;
  date_fin: string;
  actif: boolean;
}

export interface SportOption {
  id: string;
  nom: string;
}

const inputBase =
  "w-full bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50";
const labelCls =
  "block text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-1.5";

/** Vide → null. Un champ laissé vide est un JOKER (toutes disciplines, pas
 *  de borne), pas un zéro — d'où le passage explicite par null. */
function toNullableInt(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

export default function BlackoutForm({
  initial,
  sports,
  onSaved,
  onCancel,
}: {
  /** Absent = création. Présent = édition de cette ligne. */
  initial?: BlackoutRow;
  sports: SportOption[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(initial);
  const [libelle, setLibelle] = useState(initial?.libelle ?? "");
  const [sportId, setSportId] = useState<string>(initial?.sport_id ?? "");
  const [promoMin, setPromoMin] = useState<string>(initial?.promo_min?.toString() ?? "");
  const [promoMax, setPromoMax] = useState<string>(initial?.promo_max?.toString() ?? "");
  const [dateDebut, setDateDebut] = useState(initial?.date_debut ?? "");
  const [dateFin, setDateFin] = useState(initial?.date_fin ?? "");
  const [actif, setActif] = useState(initial?.actif ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!libelle.trim()) { setError("Le libellé est obligatoire."); return; }
    if (!dateDebut || !dateFin) { setError("Les deux dates sont obligatoires."); return; }
    if (dateFin < dateDebut) { setError("La date de fin ne peut pas précéder la date de début."); return; }
    const pmin = toNullableInt(promoMin);
    const pmax = toNullableInt(promoMax);
    if (pmin !== null && pmax !== null && pmax < pmin) {
      setError("La promotion de fin ne peut pas précéder celle de début."); return;
    }

    setBusy(true);
    const supabase = createClient();
    const payload = {
      libelle: libelle.trim(),
      sport_id: sportId || null,
      promo_min: pmin,
      promo_max: pmax,
      date_debut: dateDebut,
      date_fin: dateFin,
      actif,
    };

    /* Les mêmes règles existent en CHECK côté base : ces validations
       client servent le confort, pas la sécurité. Si l'une passe entre
       les mailles, la contrainte refuse et l'erreur remonte ici. */
    const { error: err } = isEdit
      ? await supabase.from("blackout_periods").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", initial!.id)
      : await supabase.from("blackout_periods").insert(payload);

    setBusy(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5 sm:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="bl-libelle">Libellé</label>
          <input id="bl-libelle" className={inputBase} value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Ex. Silence RSEQ — football, fin de saison" />
          <p className="text-[11px] text-[#6b7280] mt-1.5">
            Visible par toi seul aujourd&apos;hui ; destiné à devenir le message affiché aux recruteurs.
          </p>
        </div>

        <div>
          <label className={labelCls} htmlFor="bl-sport">Sport</label>
          <select id="bl-sport" className={inputBase} value={sportId}
            onChange={(e) => setSportId(e.target.value)}>
            <option value="">Toutes les disciplines</option>
            {sports.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </div>

        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)}
              className="w-4 h-4 accent-[#22C55E]" />
            <span className="text-[13px] text-white">Période armée</span>
          </label>
        </div>

        <div>
          <label className={labelCls} htmlFor="bl-pmin">Promotion — de</label>
          <input id="bl-pmin" className={inputBase} inputMode="numeric" value={promoMin}
            onChange={(e) => setPromoMin(e.target.value)} placeholder="toutes" />
        </div>
        <div>
          <label className={labelCls} htmlFor="bl-pmax">Promotion — à</label>
          <input id="bl-pmax" className={inputBase} inputMode="numeric" value={promoMax}
            onChange={(e) => setPromoMax(e.target.value)} placeholder="toutes" />
        </div>

        <div>
          <label className={labelCls} htmlFor="bl-debut">Début</label>
          <input id="bl-debut" type="date" className={inputBase} value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="bl-fin">Fin</label>
          <input id="bl-fin" type="date" className={inputBase} value={dateFin}
            onChange={(e) => setDateFin(e.target.value)} />
        </div>
      </div>

      <p className="text-[12px] text-[#9CA3AF] mt-4 leading-relaxed">
        Les deux dates sont <strong className="text-white">incluses</strong>. Laisser un champ de
        promotion vide retire cette borne ; les deux vides visent toutes les promotions.
      </p>

      {error && (
        <p className="mt-3 text-[12px] text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 mt-5">
        <button type="button" onClick={() => { void submit(); }} disabled={busy}
          className="px-4 py-2.5 rounded-lg bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#D42B22] disabled:opacity-50 transition-colors">
          {busy ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer la période"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy}
          className="px-4 py-2.5 rounded-lg border border-[#2D3748] text-[#9CA3AF] text-[12px] font-bold uppercase tracking-wider hover:text-white transition-colors">
          Annuler
        </button>
      </div>
    </div>
  );
}
