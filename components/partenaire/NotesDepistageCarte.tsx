"use client";

/* Les notes de DÉPISTAGE liées à une carte « En attente » du partenaire (BP 2026-10-19) :
   « Notes de dépistage (N) », dépliables. Rien quand la carte n'en a pas. */

import { useState } from "react";
import { useNotesCartePartenaire } from "@/lib/gameOn/useGameOn";

export default function NotesDepistageCarte({ carteId, nb }: { carteId: string; nb: number }) {
  const [ouvert, setOuvert] = useState(false);
  const notesQ = useNotesCartePartenaire(ouvert ? carteId : null);
  if (nb <= 0) return null;
  return (
    <div className="mt-2" data-notes-depistage={carteId}>
      <button type="button" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}
        className="min-h-[36px] text-[12px] font-bold text-[#22C55E] hover:underline">
        Notes de dépistage ({nb}) {ouvert ? "▴" : "▾"}
      </button>
      {ouvert && (
        notesQ.isLoading ? <p className="text-[12px] text-[#6b7280]">Chargement…</p> : (
          <ul className="mt-1 space-y-1.5">
            {[...(notesQ.data ?? [])].reverse().map((n) => (
              <li key={n.id} className="rounded-lg bg-white/[0.03] px-3 py-2 text-[13px] text-[#c8c8cc] whitespace-pre-line">
                <span className="block text-[11px] text-[#6b7280]">{new Date(n.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}</span>
                {n.content}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
