"use client";

import { useState } from "react";
import type { NotificationPreferences } from "../_data/mockSettingsData";
import { NOTIFICATION_LABELS } from "../_data/mockSettingsData";

/* ─────────────────────────────────────────────────────────────────
   NotificationsSection — 6 notification types × 3 channels
───────────────────────────────────────────────────────────────── */

const CHANNELS: { key: "email" | "push" | "sms"; label: string }[] = [
  { key: "email", label: "Courriel" },
  { key: "push", label: "Push" },
  { key: "sms", label: "SMS" },
];

interface Props {
  data: NotificationPreferences;
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-[40px] h-[24px] rounded-full transition-all duration-300 ease-in-out cursor-pointer shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] ${
        on ? "bg-[#22C55E]" : "bg-[#1a1f2e]"
      }`}
    >
      <span
        className={`absolute top-[4px] left-0 w-[16px] h-[16px] rounded-full bg-gradient-to-b from-white to-[#e8e8e8] shadow-[0_1px_3px_rgba(0,0,0,0.35),0_0_0_0.5px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out ${
          on ? "translate-x-[20px]" : "translate-x-[4px]"
        }`}
      />
    </button>
  );
}

export default function NotificationsSection({ data }: Props) {
  const [prefs, setPrefs] = useState<NotificationPreferences>({ ...data });
  const [saved, setSaved] = useState(false);

  function toggle(
    notifKey: keyof NotificationPreferences,
    channel: "email" | "push" | "sms"
  ) {
    setPrefs((prev) => ({
      ...prev,
      [notifKey]: {
        ...prev[notifKey],
        [channel]: !prev[notifKey][channel],
      },
    }));
    setSaved(false);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const notifKeys = Object.keys(NOTIFICATION_LABELS) as (keyof NotificationPreferences)[];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Notifications</h2>
        <p className="text-[14px] text-[#6b7280] mt-1">Choisis comment tu veux être notifié.</p>
      </div>

      <div className="max-w-2xl space-y-1">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_repeat(3,64px)] gap-2 px-4 py-2">
          <span />
          {CHANNELS.map((ch) => (
            <span key={ch.key} className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#6b7280] text-center">
              {ch.label}
            </span>
          ))}
        </div>

        {/* Notification rows */}
        {notifKeys.map((nk) => (
          <div
            key={nk}
            className="grid grid-cols-[1fr_repeat(3,64px)] gap-2 items-center px-4 py-3 rounded-lg hover:bg-white/[0.02] transition-colors"
          >
            <span className="text-[14px] font-semibold text-[#e0e0e0]">
              {NOTIFICATION_LABELS[nk]}
            </span>
            {CHANNELS.map((ch) => (
              <div key={ch.key} className="flex justify-center">
                <Toggle on={prefs[nk][ch.key]} onToggle={() => toggle(nk, ch.key)} />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 pt-2">
        <button
          type="button"
          onClick={handleSave}
          className="bg-[#E63946] hover:bg-[#D42B22] text-white text-[14px] font-bold px-6 py-2.5 rounded-lg transition-colors"
        >
          Enregistrer
        </button>
        {saved && (
          <span className="text-[14px] font-semibold text-[#22C55E] animate-pulse">
            Préférences enregistrées
          </span>
        )}
      </div>
    </div>
  );
}
