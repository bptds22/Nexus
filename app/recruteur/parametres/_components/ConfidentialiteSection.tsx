"use client";

import type { RecruiterSettings, RecruiterVisibility } from "@/lib/types/models";
import { CEGEP_LIST } from "@/lib/mock/recruiterSettings";
import SettingsToggle from "./SettingsToggle";

/* ─────────────────────────────────────────────────────────────────
   ConfidentialiteSection — Privacy & visibility
───────────────────────────────────────────────────────────────── */

interface Props {
  form: RecruiterSettings;
  original: RecruiterSettings;
  onUpdateVisibility: (vis: RecruiterVisibility) => void;
  onSave: () => void;
}

export default function ConfidentialiteSection({ form, original, onUpdateVisibility, onSave }: Props) {
  const selectedCegep = CEGEP_LIST.find((c) => c.id === form.cegepId);
  const dirty = JSON.stringify(form.visibility) !== JSON.stringify(original.visibility);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Confidentialité et visibilité</h2>
        <p className="text-[14px] text-[#6b7280] mt-1">Contrôlez ce que les coachs et autres utilisateurs voient de vous.</p>
      </div>

      <div>
        <SettingsToggle
          checked={form.visibility.profileVisible}
          onChange={(v) => onUpdateVisibility({ ...form.visibility, profileVisible: v })}
          label="Mon profil est visible par les coachs"
          sublabel="Les coachs peuvent voir votre CÉGEP, sport et rôle"
        />
        <SettingsToggle
          checked={form.visibility.showConsultationHistory}
          onChange={(v) => onUpdateVisibility({ ...form.visibility, showConsultationHistory: v })}
          label="Afficher mes consultations de profils"
          sublabel="Les coachs voient quand vous consultez un de leurs athlètes"
        />
        <SettingsToggle
          checked={form.visibility.showFullName}
          onChange={(v) => onUpdateVisibility({ ...form.visibility, showFullName: v })}
          label="Afficher mon nom complet"
          sublabel={`Sinon, vous apparaîtrez comme « Recruteur du ${selectedCegep?.name ?? "CÉGEP"} »`}
        />
      </div>

      <div className="bg-[#E63946]/[0.04] border-l-[3px] border-[#E63946] rounded-r-lg px-4 py-3">
        <p className="text-[12px] text-[#9CA3AF] leading-relaxed">
          Plus vous êtes visible, plus les coachs reçoivent de signaux d&apos;intérêt pour leurs athlètes.
          La visibilité favorise la confiance dans l&apos;écosystème.
        </p>
      </div>

      <div className="flex items-center gap-4 pt-2">
        <button type="button" onClick={onSave} disabled={!dirty}
          className={`px-6 py-2.5 rounded-lg font-head font-bold text-[14px] uppercase tracking-widest transition-all ${
            dirty ? "bg-[#E63946] text-white hover:bg-[#D42B22] cursor-pointer" : "bg-[#333] text-[#6B7280] cursor-not-allowed"
          }`}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}
