"use client";

import type { RecruiterSettings, RecruiterNotificationPrefs } from "@/lib/types/models";

/* ─────────────────────────────────────────────────────────────────
   NotificationsSection — Redesigned with sections + segmented control
───────────────────────────────────────────────────────────────── */

type NotifKey = keyof Omit<RecruiterNotificationPrefs, "weeklyDigest" | "emailFrequency">;

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      aria-label={checked ? "Activé" : "Désactivé"}
      onClick={() => onChange(!checked)}
      className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${checked ? "bg-[#E63946]" : "bg-[#2D3748]"}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

interface NotifRowData {
  key: NotifKey;
  icon: string;
  iconColor: string;
  label: string;
  sublabel: string;
}

const RECRUITMENT_ROWS: NotifRowData[] = [
  { key: "newAthleteInSport", icon: "🏈", iconColor: "#3B82F6", label: "Nouvel athlète dans mon sport", sublabel: "Matche vos critères de recrutement" },
  { key: "favoriteUpdated", icon: "🔄", iconColor: "#F59E0B", label: "Mise à jour d'un favori", sublabel: "Profil, stats ou vidéo modifié" },
  { key: "scoutingReport", icon: "📋", iconColor: "#10B981", label: "Rapport d'évaluation disponible", sublabel: "Nouvelle évaluation coach" },
  { key: "profileVerified", icon: "✅", iconColor: "#10B981", label: "Profil vérifié", sublabel: "Un favori obtient le statut vérifié" },
];

const COMMUNICATION_ROWS: NotifRowData[] = [
  { key: "coachResponse", icon: "💬", iconColor: "#8B5CF6", label: "Réponse d'un coach", sublabel: "À un de vos messages" },
  { key: "letterOfIntentSigned", icon: "📝", iconColor: "#EF4444", label: "Lettre d'intention signée", sublabel: "Un favori s'engage avec un CÉGEP" },
];

interface Props {
  form: RecruiterSettings;
  original: RecruiterSettings;
  onUpdateNotifications: (notifs: RecruiterNotificationPrefs) => void;
  onSave: () => void;
}

export default function NotificationsSection({ form, original, onUpdateNotifications, onSave }: Props) {
  const dirty = JSON.stringify(form.notifications) !== JSON.stringify(original.notifications);

  function updateNotif(key: NotifKey, field: "inApp" | "email", value: boolean) {
    onUpdateNotifications({ ...form.notifications, [key]: { ...form.notifications[key], [field]: value } });
  }

  function NotifRow({ row }: { row: NotifRowData }) {
    return (
      <div className="bg-[#13151a] rounded-lg border border-[#2A2D35] p-4 mb-2 hover:border-[#3a3d46] transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[16px]" style={{ backgroundColor: `${row.iconColor}15` }}>
            {row.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-white">{row.label}</p>
            <p className="text-[11px] text-[#6b7280] mt-0.5">{row.sublabel}</p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] font-bold text-[#4a4d56] uppercase tracking-wider">App</span>
              <Toggle checked={form.notifications[row.key].inApp} onChange={(v) => updateNotif(row.key, "inApp", v)} />
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] font-bold text-[#4a4d56] uppercase tracking-wider">Email</span>
              <Toggle checked={form.notifications[row.key].email} onChange={(v) => updateNotif(row.key, "email", v)} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Notifications</h2>
        <p className="text-[14px] text-[#6b7280] mt-1">Contrôlez ce que vous recevez et comment.</p>
      </div>

      {/* Recrutement section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-0.5 h-4 bg-[#E63946] rounded-full" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Recrutement</span>
        </div>
        {RECRUITMENT_ROWS.map(row => <NotifRow key={row.key} row={row} />)}
      </div>

      {/* Communication section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-0.5 h-4 bg-[#E63946] rounded-full" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Communication</span>
        </div>
        {COMMUNICATION_ROWS.map(row => <NotifRow key={row.key} row={row} />)}
      </div>

      {/* Save */}
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty}
        className={`w-full py-3 rounded-lg font-head font-bold text-[14px] uppercase tracking-widest transition-all ${
          dirty ? "bg-[#E63946] text-white hover:bg-[#D42B22]" : "bg-[#2D3748] text-[#6b7280] cursor-not-allowed"
        }`}
      >
        Enregistrer les préférences
      </button>
    </div>
  );
}
