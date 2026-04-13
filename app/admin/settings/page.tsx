"use client";

/* ─────────────────────────────────────────────────────────────────
   Admin Settings — Aucune table de configuration n'existe encore.
   Discovery: aucune table `app_settings`, `settings`, `config` ou
   `feature_flags` dans le schéma public.
   La page expose la structure prête pour une future table.
───────────────────────────────────────────────────────────────── */

interface PreviewRow {
  key: string;
  value: string;
  description: string;
  type: "boolean" | "string" | "number";
}

const PREVIEW: PreviewRow[] = [
  { key: "verification_threshold", value: "70", description: "Seuil de complétion pour le badge vérifié", type: "number" },
  { key: "current_season", value: "2025-2026", description: "Saison de recrutement active", type: "string" },
  { key: "auto_advance_pipeline", value: "true", description: "Avancement automatique du pipeline", type: "boolean" },
  { key: "maintenance_mode", value: "false", description: "Mode maintenance plateforme", type: "boolean" },
  { key: "intro_message_template", value: "Bonjour [Coach]…", description: "Template d'introduction recruteur", type: "string" },
];

export default function AdminSettingsPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Paramètres globaux
        </h1>
        <p className="text-[13px] text-[#6b7280] mt-1">
          Configuration système de la plateforme Nexus.
        </p>
      </div>

      <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-10 text-center">
        <p className="text-[14px] text-[#9CA3AF] mb-2">Aucune table de configuration trouvée.</p>
        <p className="text-[12px] text-[#6b7280] max-w-xl mx-auto">
          Structure de la page prête pour une future table{" "}
          <code className="text-[#E63946]">app_settings</code>. Une fois la table créée,
          les valeurs ci-dessous deviendront éditables.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">
            Aperçu — structure attendue
          </p>
          <span className="px-2 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] text-[10px] font-bold uppercase">
            Preview
          </span>
        </div>

        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl overflow-hidden">
          <table className="w-full text-[13px] text-[#E0E0E0]">
            <thead>
              <tr className="bg-[#13151a] border-b border-[#2D3748]">
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Clé</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Valeur</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Type</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Description</th>
              </tr>
            </thead>
            <tbody>
              {PREVIEW.map((row) => (
                <tr key={row.key} className="border-b border-[#2D3748]/50">
                  <td className="px-4 py-3">
                    <code className="text-[12px] text-[#E63946]">{row.key}</code>
                  </td>
                  <td className="px-4 py-3 text-[#9CA3AF] italic">{row.value}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-[#3B82F6]/15 text-[#3B82F6] text-[10px] font-bold uppercase">
                      {row.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#6b7280]">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
