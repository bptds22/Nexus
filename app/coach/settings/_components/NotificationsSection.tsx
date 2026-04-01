"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NotificationPreferences } from "../_data/mockSettingsData";
import { NOTIFICATION_LABELS } from "../_data/mockSettingsData";

/* ─────────────────────────────────────────────────────────────────
   NotificationsSection — 6 notification types x 3 channels
───────────────────────────────────────────────────────────────── */

const CHANNELS: { key: "email" | "push" | "sms"; label: string }[] = [
  { key: "email", label: "Courriel" },
  { key: "push", label: "Push" },
  { key: "sms", label: "SMS" },
];

/** Maps DB event_type → form key */
const EVENT_TYPE_MAP: Record<string, keyof NotificationPreferences> = {
  NOUVELLE_DEMANDE_CONTACT: "newContactRequest",
  DEMANDE_ACCEPTEE: "requestAccepted",
  NOUVEAU_MESSAGE: "newMessage",
  PROFIL_ATHLETE_APPROUVE: "profileApproved",
  PROFIL_ATHLETE_REFUSE: "profileRejected",
  RESUME_HEBDOMADAIRE: "weeklyDigest",
};

/** Reverse map: form key → DB event_type */
const FORM_KEY_TO_EVENT: Record<keyof NotificationPreferences, string> = {
  newContactRequest: "NOUVELLE_DEMANDE_CONTACT",
  requestAccepted: "DEMANDE_ACCEPTEE",
  newMessage: "NOUVEAU_MESSAGE",
  profileApproved: "PROFIL_ATHLETE_APPROUVE",
  profileRejected: "PROFIL_ATHLETE_REFUSE",
  weeklyDigest: "RESUME_HEBDOMADAIRE",
};

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

const DEFAULT_PREFS: NotificationPreferences = {
  newContactRequest: { email: false, push: false, sms: false },
  requestAccepted: { email: false, push: false, sms: false },
  newMessage: { email: false, push: false, sms: false },
  profileApproved: { email: false, push: false, sms: false },
  profileRejected: { email: false, push: false, sms: false },
  weeklyDigest: { email: false, push: false, sms: false },
};

export default function NotificationsSection() {
  const [prefs, setPrefs] = useState<NotificationPreferences>({ ...DEFAULT_PREFS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: rows, error: fetchErr } = await supabase
        .from("notification_preferences")
        .select("event_type, courriel, push, sms")
        .eq("user_id", user.id);
      console.log("NotificationsSection — rows:", rows, fetchErr);

      if (rows && rows.length > 0) {
        const built = { ...DEFAULT_PREFS };
        for (const row of rows) {
          const formKey = EVENT_TYPE_MAP[row.event_type];
          if (formKey) {
            built[formKey] = {
              email: !!row.courriel,
              push: !!row.push,
              sms: !!row.sms,
            };
          }
        }
        setPrefs(built);
      }
      setLoading(false);
    }
    loadData();
  }, []);

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
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setError("Non authentifié"); return; }

    const notifKeys = Object.keys(NOTIFICATION_LABELS) as (keyof NotificationPreferences)[];

    for (const nk of notifKeys) {
      const eventType = FORM_KEY_TO_EVENT[nk];
      const vals = prefs[nk];
      const { error: upsertErr } = await supabase
        .from("notification_preferences")
        .upsert(
          {
            user_id: user.id,
            event_type: eventType,
            courriel: vals.email,
            push: vals.push,
            sms: vals.sms,
          },
          { onConflict: "user_id,event_type" }
        );
      if (upsertErr) {
        console.log("NotificationsSection — upsert error:", eventType, upsertErr);
        setSaving(false);
        setError("Erreur lors de la sauvegarde.");
        return;
      }
    }
    console.log("NotificationsSection — saved all prefs");

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const notifKeys = Object.keys(NOTIFICATION_LABELS) as (keyof NotificationPreferences)[];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
          disabled={saving}
          className="bg-[#E63946] hover:bg-[#D42B22] text-white text-[14px] font-bold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
        {saved && (
          <span className="text-[14px] font-semibold text-[#22C55E] animate-pulse">
            Préférences enregistrées
          </span>
        )}
        {error && (
          <span className="text-[14px] font-semibold text-[#EF4444]">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
