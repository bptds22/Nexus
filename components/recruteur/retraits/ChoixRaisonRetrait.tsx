"use client";

/* ChoixRaisonRetrait — « Pourquoi ? » : 3 raisons (obligatoire) + note facultative. Se glisse dans
   les confirmations existantes (web : ConfirmModal du processus ; appli : feuille de retrait).
   LigneRetrait — la raison affichée sur une carte retirée. Règles : lib/retraits/retraits. */
import { NOTE_RETRAIT_MAX, RAISONS_RETRAIT, resumeRetrait, type RaisonRetrait } from "@/lib/retraits/retraits";
import { useRetrait } from "@/lib/queries/recruiter/useRetraits";

export function ChoixRaisonRetrait({ raison, onRaison, note, onNote, mobile = false }: {
  raison: RaisonRetrait | null;
  onRaison: (r: RaisonRetrait) => void;
  note: string;
  onNote: (v: string) => void;
  mobile?: boolean;
}) {
  return (
    <div className="mt-3" data-testid="choix-raison-retrait">
      <p className={`font-bold uppercase tracking-wider text-[#9CA3AF] ${mobile ? "text-[12px]" : "text-[11px]"}`}>Pourquoi ?</p>
      <div className="mt-2 grid gap-2" role="radiogroup" aria-label="Raison du retrait">
        {RAISONS_RETRAIT.map((r) => {
          const actif = raison === r.code;
          return (
            <button key={r.code} type="button" role="radio" aria-checked={actif} onClick={() => onRaison(r.code)}
              className={`flex w-full items-center justify-between rounded-lg border px-4 text-left transition-colors ${mobile ? "min-h-[48px] py-2.5" : "py-2.5"} ${
                actif ? "border-[#EF4444] bg-[#EF4444]/10" : "border-[#2a2d36] bg-[#13151a] hover:border-[#4a4d56]"}`}>
              <span className="min-w-0">
                <span className={`block font-bold text-white ${mobile ? "text-[15px]" : "text-[13px]"}`}>{r.libelle}</span>
                <span className={`block text-[#6b7280] ${mobile ? "text-[13px]" : "text-[11px]"}`}>{r.aide}</span>
              </span>
              <span aria-hidden className={`ml-3 h-4 w-4 shrink-0 rounded-full border-2 ${actif ? "border-[#EF4444] bg-[#EF4444]" : "border-[#4a4d56]"}`} />
            </button>
          );
        })}
      </div>
      <textarea value={note} onChange={(e) => onNote(e.target.value.slice(0, NOTE_RETRAIT_MAX))} maxLength={NOTE_RETRAIT_MAX}
        placeholder={raison === "AUTRE" ? "Précise la raison (facultatif)" : "Note (facultatif)"} rows={2}
        className={`mt-3 w-full resize-none rounded-lg border border-[#2a2d36] bg-[#13151a] px-4 py-2.5 text-[#e0e0e0] outline-none transition-colors placeholder:text-[#4a4d56] focus:border-[#E63946] ${mobile ? "text-[16px]" : "text-[13px]"}`} />
    </div>
  );
}

/** « Pas le niveau · Pas assez rapide pour le D1 · par Julie, 18 oct. » sous une carte retirée. */
export function LigneRetrait({ id, carte, className = "" }: { id: string; carte: boolean; className?: string }) {
  const r = useRetrait(id, carte);
  if (!r) return null;
  return <p className={`text-[11px] leading-snug text-[#9CA3AF] ${className}`} data-testid="ligne-retrait">{resumeRetrait(r)}</p>;
}
