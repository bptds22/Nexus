"use client";

/* ─────────────────────────────────────────────────────────────────
   DangerSection — export réel (JSON) et suppression du compte.
   « Désactiver » retiré (BP 2026-10-01) : c'était une maquette sans effet.
───────────────────────────────────────────────────────────────── */

interface Props {
  onExport: () => void;
  exporting?: boolean;
  erreurExport?: string | null;
  onDelete: () => void;
}

export default function DangerSection({ onExport, exporting = false, erreurExport = null, onDelete }: Props) {
  return (
    <div id="zone-danger" className="space-y-8">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Zone danger</h2>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          Ces actions sont irréversibles ou ont un impact majeur sur votre compte.
        </p>
      </div>

      <div className="space-y-5">
        {/* Export */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border border-[#2a2d36]">
          <div className="flex-1">
            <p className="text-[14px] font-bold text-[#9CA3AF]">Exporter mes données</p>
            <p className="text-[12px] text-[#6B7280] mt-1 leading-relaxed">
              Téléchargez un fichier JSON contenant votre profil, vos favoris, votre processus, vos notes, vos listes, vos avis et vos messages. Conformité Loi 25 — droit à la portabilité.
            </p>
          </div>
          <button type="button" onClick={onExport} disabled={exporting}
            className="shrink-0 px-5 py-2 rounded-lg border border-[#6B7280] text-[#6B7280] text-[13px] font-bold uppercase tracking-wider hover:border-[#9CA3AF] hover:text-[#9CA3AF] transition-colors disabled:opacity-50">
            {exporting ? "Export en cours..." : "Exporter"}
          </button>
        </div>
        {erreurExport && <p className="text-[12px] text-[#F59E0B] -mt-3" role="alert">{erreurExport}</p>}

        {/* Delete */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border border-[#E63946]/30 bg-[#E63946]/[0.04]">
          <div className="flex-1">
            <p className="text-[14px] font-bold text-white">Supprimer définitivement mon compte</p>
            <p className="text-[12px] text-[#9CA3AF] mt-1 leading-relaxed">
              Votre compte et vos données personnelles seront supprimés immédiatement et définitivement. Cette action est irréversible. Conformité Loi 25 — droit à l&apos;effacement.
            </p>
          </div>
          <button type="button" onClick={onDelete}
            className="shrink-0 px-5 py-2 rounded-lg bg-[#E63946] text-white text-[13px] font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors">
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
