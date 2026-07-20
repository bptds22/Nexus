"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────────────────────────
   NotificationsSection — Coach/Directeur sportif
   Redesigned to match the recruiter notification settings layout:
   categorized sections with red left border, icon rows, APP/EMAIL toggles.
───────────────────────────────────────────────────────────────── */

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

/* ── Notification categories ── */

interface NotifRowData {
  key: string;
  icon: string;
  iconColor: string;
  label: string;
  sublabel: string;
}

const RECRUTEMENT_ROWS: NotifRowData[] = [
  { key: "newContactRequest", icon: "📨", iconColor: "#22C55E", label: "Nouvelle demande de contact", sublabel: "Un recruteur veut contacter un de vos athlètes" },
  { key: "athleteFavorited", icon: "❤️", iconColor: "#E63946", label: "Athlète ajouté en favori", sublabel: "Un recruteur a ajouté un de vos athlètes en favori" },
  { key: "pipelineMovement", icon: "📋", iconColor: "#F59E0B", label: "Mouvement dans un processus", sublabel: "Un athlète a changé de stage dans un processus recruteur" },
  { key: "letterOfIntent", icon: "✍️", iconColor: "#22C55E", label: "Lettre d'intention signée", sublabel: "Un de vos athlètes a signé une lettre d'intention" },
];

const PROFILS_ROWS: NotifRowData[] = [
  { key: "profileIncomplete", icon: "⚠️", iconColor: "#F59E0B", label: "Profil athlète incomplet", sublabel: "Un athlète a un profil en dessous de 60%" },
  { key: "newSignup", icon: "🆕", iconColor: "#3B82F6", label: "Nouvelle inscription", sublabel: "Un athlète s'est inscrit via votre lien d'invitation" },
];

const COMMUNICATION_ROWS: NotifRowData[] = [
  { key: "newMessage", icon: "💬", iconColor: "#8B5CF6", label: "Nouveau message reçu", sublabel: "Un recruteur ou athlète vous a envoyé un message" },
  { key: "evaluationRequested", icon: "📝", iconColor: "#10B981", label: "Nouvelle évaluation demandée", sublabel: "Un recruteur demande votre évaluation d'un athlète" },
];

const RESUME_ROWS: NotifRowData[] = [
  { key: "weeklyDigest", icon: "📊", iconColor: "#6B7280", label: "Résumé hebdomadaire", sublabel: "Activité de vos athlètes cette semaine" },
];

const ALL_ROWS = [...RECRUTEMENT_ROWS, ...PROFILS_ROWS, ...COMMUNICATION_ROWS, ...RESUME_ROWS];

/* ── DB mapping ── */

const DB_EVENT_MAP: Record<string, string> = {
  newContactRequest: "NOUVELLE_DEMANDE_CONTACT",
  athleteFavorited: "ATHLETE_FAVORI",
  pipelineMovement: "MOUVEMENT_PIPELINE",
  letterOfIntent: "LETTRE_INTENTION",
  profileIncomplete: "PROFIL_INCOMPLET",
  newSignup: "NOUVELLE_INSCRIPTION",
  newMessage: "NOUVEAU_MESSAGE",
  evaluationRequested: "EVALUATION_DEMANDEE",
  weeklyDigest: "RESUME_HEBDOMADAIRE",
};

const REVERSE_MAP: Record<string, string> = {};
for (const [formKey, dbKey] of Object.entries(DB_EVENT_MAP)) {
  REVERSE_MAP[dbKey] = formKey;
}

/* ── Component ── */

type Prefs = Record<string, { inApp: boolean; email: boolean }>;

function buildDefaultPrefs(): Prefs {
  const p: Prefs = {};
  for (const row of ALL_ROWS) {
    p[row.key] = { inApp: true, email: true };
  }
  return p;
}

export default function NotificationsSection() {
  const [prefs, setPrefs] = useState<Prefs>(buildDefaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalJson, setOriginalJson] = useState("");

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: rows } = await supabase
        .from("notification_preferences")
        .select("event_type, courriel, push")
        .eq("user_id", user.id);

      if (rows && rows.length > 0) {
        const built = buildDefaultPrefs();
        for (const row of rows) {
          const formKey = REVERSE_MAP[row.event_type];
          if (formKey && built[formKey]) {
            built[formKey] = {
              inApp: !!row.push,
              email: !!row.courriel,
            };
          }
        }
        setPrefs(built);
        setOriginalJson(JSON.stringify(built));
      } else {
        setOriginalJson(JSON.stringify(prefs));
      }
      setLoading(false);
    }
    loadData();
  }, []);

  function update(key: string, field: "inApp" | "email", value: boolean) {
    setPrefs((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
    setSaved(false);
    setError(null);
  }

  const dirty = JSON.stringify(prefs) !== originalJson;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setError("Non authentifié"); return; }

    for (const row of ALL_ROWS) {
      const eventType = DB_EVENT_MAP[row.key];
      const vals = prefs[row.key];
      const { error: upsertErr } = await supabase
        .from("notification_preferences")
        .upsert(
          {
            user_id: user.id,
            event_type: eventType,
            courriel: vals.email,
            push: vals.inApp,
            sms: false,
          },
          { onConflict: "user_id,event_type" }
        );
      if (upsertErr) {
        console.error("[Coach Notifications] upsert error:", eventType, upsertErr);
        setSaving(false);
        setError("Erreur lors de la sauvegarde.");
        return;
      }
    }

    setOriginalJson(JSON.stringify(prefs));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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
              <Toggle checked={prefs[row.key].inApp} onChange={(v) => update(row.key, "inApp", v)} />
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] font-bold text-[#4a4d56] uppercase tracking-wider">Email</span>
              <Toggle checked={prefs[row.key].email} onChange={(v) => update(row.key, "email", v)} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Notifications</h2>
        <p className="text-[14px] text-[#6b7280] mt-1">Contrôlez ce que vous recevez et comment.</p>
      </div>

      {/* Recrutement */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-0.5 h-4 bg-[#E63946] rounded-full" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Recrutement</span>
        </div>
        {RECRUTEMENT_ROWS.map((row) => <NotifRow key={row.key} row={row} />)}
      </div>

      {/* Profils */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-0.5 h-4 bg-[#E63946] rounded-full" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Profils</span>
        </div>
        {PROFILS_ROWS.map((row) => <NotifRow key={row.key} row={row} />)}
      </div>

      {/* Communication */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-0.5 h-4 bg-[#E63946] rounded-full" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Communication</span>
        </div>
        {COMMUNICATION_ROWS.map((row) => <NotifRow key={row.key} row={row} />)}
      </div>

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!dirty && !saving}
        className={`w-full py-3 rounded-lg font-head font-bold text-[14px] uppercase tracking-widest transition-all ${
          dirty ? "bg-[#E63946] text-white hover:bg-[#D42B22]" : "bg-[#2D3748] text-[#6b7280] cursor-not-allowed"
        }`}
      >
        {saving ? "Enregistrement..." : "Enregistrer les préférences"}
      </button>

      {saved && (
        <p className="text-[13px] font-bold text-[#22C55E] text-center animate-pulse">Préférences enregistrées</p>
      )}
      {error && (
        <p className="text-[13px] font-bold text-[#EF4444] text-center">{error}</p>
      )}
    </div>
  );
}
