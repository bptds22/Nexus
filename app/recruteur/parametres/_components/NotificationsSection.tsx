"use client";

import type { RecruiterSettings, RecruiterNotificationPrefs } from "@/lib/types/models";
import NotificationRow from "./NotificationRow";
import SettingsToggle from "./SettingsToggle";

/* ─────────────────────────────────────────────────────────────────
   NotificationsSection — Notification preferences
───────────────────────────────────────────────────────────────── */

const labelCls = "block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5";
const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";

type NotifKey = keyof Omit<RecruiterNotificationPrefs, "weeklyDigest" | "emailFrequency">;

const NOTIF_ICONS: Record<NotifKey, { svg: React.ReactNode; bg: string }> = {
  newAthleteInSport: {
    bg: "bg-[#3B82F6]/15",
    svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
  },
  favoriteUpdated: {
    bg: "bg-[#F59E0B]/15",
    svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10" /><path d="M20.49 15a9 9 0 01-14.85 3.36L1 14" /></svg>,
  },
  coachResponse: {
    bg: "bg-[#8B5CF6]/15",
    svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>,
  },
  scoutingReport: {
    bg: "bg-[#10B981]/15",
    svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
  },
  letterOfIntentSigned: {
    bg: "bg-[#EF4444]/15",
    svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>,
  },
  profileVerified: {
    bg: "bg-[#10B981]/15",
    svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  },
};

const NOTIF_ROWS: { key: NotifKey; label: string; sublabel: string }[] = [
  { key: "newAthleteInSport", label: "Nouvel athlète dans mon sport", sublabel: "Matche vos critères de recrutement" },
  { key: "favoriteUpdated", label: "Mise à jour d'un favori", sublabel: "Profil, stats ou vidéo modifié" },
  { key: "coachResponse", label: "Réponse d'un coach", sublabel: "À un de vos messages" },
  { key: "scoutingReport", label: "Rapport de dépistage disponible", sublabel: "Pour un athlète suivi" },
  { key: "letterOfIntentSigned", label: "Lettre d'intention signée", sublabel: "Un favori s'engage avec un autre CÉGEP" },
  { key: "profileVerified", label: "Profil vérifié", sublabel: "Un favori atteint le statut vérifié" },
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
    onUpdateNotifications({
      ...form.notifications,
      [key]: { ...form.notifications[key], [field]: value },
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Notifications</h2>
        <p className="text-[14px] text-[#6b7280] mt-1">Contrôlez ce que vous recevez et comment.</p>
      </div>

      {/* Table header */}
      <div>
        <div className="flex items-center px-4 py-2 border-b border-[#2a2d36]">
          <span className="flex-1 text-[11px] font-bold tracking-[0.2em] uppercase text-[#4a4d56]">Type</span>
          <div className="flex items-center gap-5 shrink-0">
            <span className="w-[36px] text-center text-[11px] font-bold tracking-[0.15em] uppercase text-[#4a4d56]">App</span>
            <span className="w-[36px] text-center text-[11px] font-bold tracking-[0.15em] uppercase text-[#4a4d56]">Email</span>
          </div>
        </div>

        <div className="rounded-lg overflow-hidden border border-[#2a2d36]">
          {NOTIF_ROWS.map((row, i) => (
            <NotificationRow
              key={row.key}
              icon={NOTIF_ICONS[row.key].svg}
              iconBg={NOTIF_ICONS[row.key].bg}
              label={row.label}
              sublabel={row.sublabel}
              inApp={form.notifications[row.key].inApp}
              email={form.notifications[row.key].email}
              onInAppChange={(v) => updateNotif(row.key, "inApp", v)}
              onEmailChange={(v) => updateNotif(row.key, "email", v)}
              even={i % 2 === 0}
            />
          ))}
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-[#2a2d36]" />

      {/* Weekly digest */}
      <SettingsToggle
        checked={form.notifications.weeklyDigest}
        onChange={(v) => onUpdateNotifications({ ...form.notifications, weeklyDigest: v })}
        label="Recevoir un résumé hebdomadaire par courriel"
        sublabel="Envoyé chaque lundi à 8h — nouveaux athlètes, mises à jour, tendances"
      />

      {/* Email frequency */}
      <div>
        <label className={labelCls}>Fréquence email</label>
        <select aria-label="Fréquence email"
          value={form.notifications.emailFrequency}
          onChange={(e) => onUpdateNotifications({ ...form.notifications, emailFrequency: e.target.value as RecruiterNotificationPrefs["emailFrequency"] })}
          className={inputCls}>
          <option value="realtime">Temps réel</option>
          <option value="daily">Quotidien (18h)</option>
          <option value="weekly">Hebdomadaire (lundi 8h)</option>
          <option value="disabled">Désactivé</option>
        </select>
        {form.notifications.emailFrequency === "disabled" && (
          <div className="mt-3 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg px-4 py-3 flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            <p className="text-[12px] text-[#F59E0B] font-bold">
              Vous ne recevrez plus aucun courriel de Nexus. Les notifications in-app resteront actives.
            </p>
          </div>
        )}
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
