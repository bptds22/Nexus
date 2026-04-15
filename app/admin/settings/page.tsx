"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────────────────────────
   Admin Settings — wired to the `app_settings` table.
   SUPER_ADMIN can add/delete settings; any admin can edit values.
───────────────────────────────────────────────────────────────── */

type SettingType = "BOOLEAN" | "NUMBER" | "STRING" | "JSON";

interface AppSetting {
  key: string;
  value: string | null;
  type: SettingType;
  description: string | null;
  updated_at?: string | null;
}

interface GroupSpec {
  id: string;
  label: string;
  test: (key: string) => boolean;
}

const GROUPS: GroupSpec[] = [
  { id: "badges",         label: "Badges",        test: (k) => k.startsWith("badge_") },
  { id: "notifications",  label: "Notifications", test: (k) => k.startsWith("notify_") },
  { id: "platform",       label: "Plateforme",    test: (k) => k.startsWith("maintenance_") || k.startsWith("registration_") },
  { id: "recruitment",    label: "Recrutement",   test: (k) => k.startsWith("staleness_") || k.startsWith("max_pipeline_") },
  { id: "season",         label: "Saison",        test: (k) => k.startsWith("current_") },
  { id: "verification",   label: "Vérification",  test: (k) => k.startsWith("verification_") },
  { id: "messaging",      label: "Messagerie",    test: (k) => k.startsWith("intro_") },
];
const OTHER_GROUP: GroupSpec = { id: "other", label: "Autres", test: () => true };

function groupFor(key: string): GroupSpec {
  return GROUPS.find((g) => g.test(key)) ?? OTHER_GROUP;
}

function normalizeType(raw: string | null | undefined): SettingType {
  const t = (raw || "STRING").toUpperCase();
  if (t === "BOOLEAN" || t === "NUMBER" || t === "JSON") return t;
  return "STRING";
}

export default function AdminSettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<{ key: string; value: string; type: SettingType; description: string }>({
    key: "", value: "", type: "STRING", description: "",
  });
  const [confirmDelete, setConfirmDelete] = useState<AppSetting | null>(null);
  const [maintModal, setMaintModal] = useState<{ turningOn: boolean; message: string; eta: string } | null>(null);
  const [version, setVersion] = useState(0);

  // ── Broadcast state ──
  type Audience = "ALL" | "COACH" | "RECRUTEUR" | "ATHLETE";
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [audience, setAudience] = useState<Audience>("ALL");
  const [confirmBroadcast, setConfirmBroadcast] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<{ message: string; audience: string; created_at: string; count: number }[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);

  const isSuperAdmin = role === "SUPER_ADMIN";
  const canBroadcast = role === "ADMIN" || role === "SUPER_ADMIN";

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
      console.log("[AdminSettings] role:", data?.role, "userId:", user.id);
      setRole((data?.role as string) ?? null);
    })();
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("created_at, metadata, actor_id")
        .eq("type", "ADMIN_BROADCAST")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        console.log("[AdminSettings] broadcast history error:", error.message);
        return;
      }
      // Group by created_at (second resolution) to collapse fanned-out inserts into single broadcasts
      const groups = new Map<string, { message: string; audience: string; created_at: string; count: number }>();
      for (const row of (data || []) as { created_at: string; metadata: Record<string, unknown> | null }[]) {
        const bucket = row.created_at.slice(0, 19);
        const msg = (row.metadata?.message as string) ?? "";
        const aud = (row.metadata?.audience as string) ?? "ALL";
        const existing = groups.get(bucket);
        if (existing) existing.count += 1;
        else groups.set(bucket, { message: msg, audience: aud, created_at: row.created_at, count: 1 });
      }
      const list = [...groups.values()].slice(0, 5);
      console.log("[AdminSettings] broadcast history groups:", list.length);
      setHistory(list);
    })();
  }, [supabase, historyVersion]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .order("key");
      if (error) {
        console.log("[AdminSettings] load error:", error.message);
        showToast(`Erreur: ${error.message}`, false);
        setLoading(false);
        return;
      }
      console.log("[AdminSettings] loaded settings:", data?.length ?? 0);
      const mapped: AppSetting[] = (data || []).map((s: Record<string, unknown>) => ({
        key: s.key as string,
        value: (s.value as string) ?? null,
        type: normalizeType(s.type as string),
        description: (s.description as string) ?? null,
        updated_at: (s.updated_at as string) ?? null,
      }));
      setSettings(mapped);
      setLoading(false);
    })();
  }, [supabase, version]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  }

  async function saveValue(key: string, newValue: string, type: SettingType) {
    if (key === "maintenance_mode" && type === "BOOLEAN") {
      const turningOn = newValue === "true";
      const message = settings.find((s) => s.key === "maintenance_message")?.value ?? "";
      const eta = settings.find((s) => s.key === "maintenance_eta")?.value ?? "";
      console.log("[AdminSettings] maintenance toggle intercepted — turningOn:", turningOn);
      setMaintModal({ turningOn, message, eta });
      return;
    }
    if (type === "JSON") {
      try { JSON.parse(newValue); } catch {
        showToast("JSON invalide", false);
        return;
      }
    }
    console.log("[AdminSettings] saving:", key, "=", newValue);
    const { error } = await supabase
      .from("app_settings")
      .update({ value: newValue, updated_at: new Date().toISOString() })
      .eq("key", key);
    if (error) {
      console.log("[AdminSettings] save error:", error.message);
      showToast(`Erreur: ${error.message}`, false);
      return;
    }
    setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, value: newValue } : s)));
    showToast("Sauvegardé", true);
  }

  async function confirmMaintenance() {
    if (!maintModal) return;
    const now = new Date().toISOString();
    console.log("[AdminSettings] confirming maintenance — turningOn:", maintModal.turningOn);

    const updates: { key: string; value: string }[] = [
      { key: "maintenance_mode", value: maintModal.turningOn ? "true" : "false" },
    ];
    if (maintModal.turningOn) {
      updates.push({ key: "maintenance_message", value: maintModal.message });
      updates.push({ key: "maintenance_eta", value: maintModal.eta });
    }

    for (const u of updates) {
      const { error } = await supabase
        .from("app_settings")
        .update({ value: u.value, updated_at: now })
        .eq("key", u.key);
      if (error) {
        console.log("[AdminSettings] maintenance save error:", u.key, error.message);
        showToast(`Erreur: ${error.message}`, false);
        return;
      }
    }

    showToast(maintModal.turningOn ? "Mode maintenance activé" : "Mode maintenance désactivé", true);
    setMaintModal(null);
    setVersion((v) => v + 1);
  }

  async function broadcast() {
    if (!broadcastMsg.trim() || !currentUserId) return;
    setSending(true);
    const message = broadcastMsg.trim();
    console.log("[AdminSettings] broadcasting to:", audience, "message:", message);

    let query = supabase.from("users").select("id, role");
    if (audience === "COACH") query = query.eq("role", "COACH");
    else if (audience === "RECRUTEUR") query = query.eq("role", "RECRUTEUR");
    else if (audience === "ATHLETE") query = query.eq("role", "ATHLETE");

    const { data: targetUsers, error: targetErr } = await query;
    if (targetErr) {
      console.log("[AdminSettings] target users error:", targetErr.message);
      showToast(`Erreur: ${targetErr.message}`, false);
      setSending(false);
      return;
    }
    const users = (targetUsers || []) as { id: string; role: string }[];
    console.log("[AdminSettings] target users fetched:", users.length);

    let delivered = 0;

    // ── Athletes → athlete_notifications ──
    const athleteUsers = users.filter((u) => u.role === "ATHLETE");
    if (athleteUsers.length > 0) {
      const { data: athleteRows, error: athErr } = await supabase
        .from("athletes")
        .select("id, user_id")
        .in("user_id", athleteUsers.map((u) => u.id));
      if (athErr) console.log("[AdminSettings] athletes lookup error:", athErr.message);
      const rows = (athleteRows || []) as { id: string; user_id: string }[];
      if (rows.length > 0) {
        const payload = rows.map((a) => ({
          athlete_id: a.id,
          type: "ADMIN_BROADCAST",
          title: message,
          read: false,
        }));
        const { error: insErr } = await supabase.from("athlete_notifications").insert(payload);
        if (insErr) {
          console.log("[AdminSettings] athlete_notifications insert error:", insErr.message);
          showToast(`Erreur athlètes: ${insErr.message}`, false);
          setSending(false);
          return;
        }
        delivered += rows.length;
      }
    }

    // ── Coaches → activities ──
    const coachUsers = users.filter((u) => u.role === "COACH");
    if (coachUsers.length > 0) {
      const payload = coachUsers.map((u) => ({
        type: "ADMIN_BROADCAST",
        actor_id: currentUserId,
        actor_role: "admin",
        coach_id: u.id,
        metadata: { message, audience },
        read: false,
      }));
      const { error: insErr } = await supabase.from("activities").insert(payload);
      if (insErr) {
        console.log("[AdminSettings] activities insert error:", insErr.message);
        showToast(`Erreur entraîneurs: ${insErr.message}`, false);
        setSending(false);
        return;
      }
      delivered += coachUsers.length;
    }

    // ── Recruiters → recruiter_activity_log ──
    const recruiterUsers = users.filter((u) => u.role === "RECRUTEUR");
    if (recruiterUsers.length > 0) {
      const payload = recruiterUsers.map((u) => ({
        recruiter_id: u.id,
        action_type: "ADMIN_BROADCAST",
        details: { message, audience },
      }));
      const { error: insErr } = await supabase.from("recruiter_activity_log").insert(payload);
      if (insErr) {
        console.log("[AdminSettings] recruiter_activity_log insert error:", insErr.message);
        showToast(`Erreur recruteurs: ${insErr.message}`, false);
        setSending(false);
        return;
      }
      delivered += recruiterUsers.length;
    }

    console.log("[AdminSettings] broadcast delivered:", delivered);
    showToast(`Message diffusé à ${delivered} utilisateur${delivered > 1 ? "s" : ""}`, true);
    setBroadcastMsg("");
    setConfirmBroadcast(false);
    setSending(false);
    setHistoryVersion((v) => v + 1);
  }

  async function addSetting() {
    if (!addForm.key.trim()) {
      showToast("Clé requise", false);
      return;
    }
    if (addForm.type === "JSON" && addForm.value) {
      try { JSON.parse(addForm.value); } catch {
        showToast("JSON invalide", false);
        return;
      }
    }
    console.log("[AdminSettings] adding:", addForm.key);
    const { error } = await supabase.from("app_settings").insert({
      key: addForm.key.trim(),
      value: addForm.value,
      type: addForm.type,
      description: addForm.description || null,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.log("[AdminSettings] insert error:", error.message);
      showToast(`Erreur: ${error.message}`, false);
      return;
    }
    showToast("Paramètre ajouté", true);
    setShowAdd(false);
    setAddForm({ key: "", value: "", type: "STRING", description: "" });
    setVersion((v) => v + 1);
  }

  async function deleteSetting(key: string) {
    console.log("[AdminSettings] deleting:", key);
    const { error } = await supabase.from("app_settings").delete().eq("key", key);
    if (error) {
      console.log("[AdminSettings] delete error:", error.message);
      showToast(`Erreur: ${error.message}`, false);
      return;
    }
    showToast("Paramètre supprimé", true);
    setConfirmDelete(null);
    setVersion((v) => v + 1);
  }

  const grouped = useMemo(() => {
    const map = new Map<string, { spec: GroupSpec; rows: AppSetting[] }>();
    for (const s of settings) {
      const g = groupFor(s.key);
      if (!map.has(g.id)) map.set(g.id, { spec: g, rows: [] });
      map.get(g.id)!.rows.push(s);
    }
    const order = [...GROUPS, OTHER_GROUP].map((g) => g.id);
    return order.flatMap((id) => (map.has(id) ? [map.get(id)!] : []));
  }, [settings]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
            Paramètres globaux
          </h1>
          <p className="text-[13px] text-[#6b7280] mt-1">
            {loading ? "Chargement…" : `${settings.length} paramètre${settings.length > 1 ? "s" : ""}`}
          </p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="shrink-0 px-5 py-2.5 rounded-lg border border-[#E63946] text-[#E63946] font-bold text-[13px] uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors"
          >
            + Ajouter un paramètre
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#6b7280]">Chargement…</div>
      ) : grouped.length === 0 ? (
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-10 text-center">
          <p className="text-[14px] text-[#9CA3AF]">Aucun paramètre configuré.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ spec, rows }) => {
            const isCollapsed = collapsed[spec.id];
            return (
              <section key={spec.id} className="bg-[#1A1D24] border border-[#2D3748] rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCollapsed((p) => ({ ...p, [spec.id]: !p[spec.id] }))}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-head text-[13px] font-black text-white uppercase tracking-[0.15em]">
                      {spec.label}
                    </span>
                    <span className="text-[11px] font-bold text-[#6b7280] tabular-nums">
                      {rows.length}
                    </span>
                  </div>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`text-[#6b7280] transition-transform ${isCollapsed ? "" : "rotate-180"}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {!isCollapsed && (
                  <div className="border-t border-[#2D3748]/60">
                    {rows.map((s) => (
                      <SettingRow
                        key={`${s.key}-${version}`}
                        setting={s}
                        isSuperAdmin={isSuperAdmin}
                        onSave={saveValue}
                        onDelete={() => setConfirmDelete(s)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {canBroadcast && (
        <section className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 space-y-5">
          <div>
            <h2 className="font-head text-[13px] font-black text-white uppercase tracking-[0.15em]">
              Message à tous les utilisateurs
            </h2>
            <p className="text-[12px] text-[#6b7280] mt-1">
              Diffuse une notification à tous les utilisateurs ciblés.
            </p>
          </div>

          <textarea
            title="Message à diffuser"
            placeholder="Écrire un message..."
            rows={3}
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            className={INPUT_CLS + " w-full"}
          />

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div className="w-full sm:w-[260px]">
              <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wider mb-1.5">
                Audience
              </label>
              <select
                title="Audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value as Audience)}
                className={INPUT_CLS + " w-full"}
              >
                <option value="ALL">Tous</option>
                <option value="COACH">Entraîneurs</option>
                <option value="RECRUTEUR">Recruteurs</option>
                <option value="ATHLETE">Athlètes</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => setConfirmBroadcast(true)}
              disabled={!broadcastMsg.trim() || sending}
              className="shrink-0 self-end px-5 py-2.5 rounded-lg bg-[#E63946] text-white font-bold text-[13px] uppercase tracking-wider hover:bg-[#D42B22] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? "Envoi..." : "Diffuser"}
            </button>
          </div>

          {history.length > 0 && (
            <div className="pt-4 border-t border-[#2D3748]/60">
              <h3 className="text-[11px] font-bold text-[#6b7280] uppercase tracking-wider mb-3">
                Derniers messages diffusés
              </h3>
              <ul className="space-y-2">
                {history.map((h, i) => (
                  <li key={h.created_at + i} className="px-3 py-2.5 rounded-lg bg-[#111317] border border-white/5">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                        {audienceLabel(h.audience)} — {h.count} envoi{h.count > 1 ? "s" : ""}
                      </span>
                      <span className="text-[11px] text-[#6b7280]">
                        {new Date(h.created_at).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    <p className="text-[13px] text-[#E0E0E0] leading-snug line-clamp-2">
                      {h.message || <span className="text-[#6b7280] italic">(aucun contenu)</span>}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {confirmBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !sending && setConfirmBroadcast(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 w-full max-w-[460px] shadow-2xl mx-4">
            <h2 className="font-head text-[16px] font-black text-white uppercase mb-3">
              Diffuser le message
            </h2>
            <p className="text-[13px] text-[#9CA3AF] mb-5">
              Envoyer ce message à <span className="font-bold text-white">{audienceLabel(audience)}</span>?
            </p>
            <div className="bg-[#111317] border border-white/5 rounded-lg px-3 py-2.5 mb-6">
              <p className="text-[13px] text-[#E0E0E0] leading-snug whitespace-pre-wrap">{broadcastMsg}</p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmBroadcast(false)}
                disabled={sending}
                className="px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={broadcast}
                disabled={sending}
                className="px-5 py-2.5 rounded-lg bg-[#E63946] text-white font-bold text-[13px] uppercase tracking-wider hover:bg-[#D42B22] disabled:opacity-40 transition-colors"
              >
                {sending ? "Envoi..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 w-full max-w-[520px] shadow-2xl mx-4">
            <h2 className="font-head text-[16px] font-black text-white uppercase mb-5">
              Ajouter un paramètre
            </h2>
            <div className="space-y-4">
              <Field label="Clé (snake_case) *">
                <input
                  type="text"
                  value={addForm.key}
                  onChange={(e) => setAddForm({ ...addForm, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                  placeholder="ex: badge_threshold_verified"
                  className={INPUT_CLS + " w-full"}
                />
              </Field>
              <Field label="Type">
                <select
                  title="Type"
                  value={addForm.type}
                  onChange={(e) => setAddForm({ ...addForm, type: e.target.value as SettingType })}
                  className={INPUT_CLS + " w-full"}
                >
                  <option value="STRING">STRING</option>
                  <option value="NUMBER">NUMBER</option>
                  <option value="BOOLEAN">BOOLEAN</option>
                  <option value="JSON">JSON</option>
                </select>
              </Field>
              <Field label="Valeur">
                {addForm.type === "BOOLEAN" ? (
                  <select
                    title="Valeur"
                    value={addForm.value || "false"}
                    onChange={(e) => setAddForm({ ...addForm, value: e.target.value })}
                    className={INPUT_CLS + " w-full"}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : addForm.type === "JSON" ? (
                  <textarea
                    title="Valeur JSON"
                    rows={4}
                    value={addForm.value}
                    onChange={(e) => setAddForm({ ...addForm, value: e.target.value })}
                    placeholder='{ "foo": "bar" }'
                    className={INPUT_CLS + " w-full font-mono text-[12px]"}
                  />
                ) : (
                  <input
                    title="Valeur"
                    placeholder="Valeur"
                    type={addForm.type === "NUMBER" ? "number" : "text"}
                    value={addForm.value}
                    onChange={(e) => setAddForm({ ...addForm, value: e.target.value })}
                    className={INPUT_CLS + " w-full"}
                  />
                )}
              </Field>
              <Field label="Description">
                <input
                  title="Description"
                  placeholder="Description"
                  type="text"
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                  className={INPUT_CLS + " w-full"}
                />
              </Field>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">
                Annuler
              </button>
              <button
                type="button"
                onClick={addSetting}
                disabled={!addForm.key}
                className="px-5 py-2.5 rounded-lg bg-[#E63946] text-white font-bold text-[13px] uppercase tracking-wider hover:bg-[#D42B22] disabled:opacity-40 transition-colors"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {maintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setMaintModal(null); setVersion((v) => v + 1); }} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 w-full max-w-[520px] shadow-2xl mx-4">
            <div className={`w-12 h-12 rounded-full mb-4 flex items-center justify-center ${maintModal.turningOn ? "bg-[#F59E0B]/15" : "bg-[#22C55E]/15"}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={maintModal.turningOn ? "#F59E0B" : "#22C55E"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {maintModal.turningOn ? (
                  <>
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </>
                ) : (
                  <polyline points="20 6 9 17 4 12" />
                )}
              </svg>
            </div>
            <h2 className="font-head text-[16px] font-black text-white uppercase mb-2">
              {maintModal.turningOn ? "Activer le mode maintenance" : "Désactiver le mode maintenance"}
            </h2>
            <p className="text-[13px] text-[#9CA3AF] mb-5">
              {maintModal.turningOn
                ? "Tous les utilisateurs (sauf admins) seront redirigés vers la page de maintenance."
                : "Les utilisateurs pourront à nouveau accéder à la plateforme."}
            </p>

            {maintModal.turningOn && (
              <div className="space-y-4 mb-6">
                <Field label="Message affiché">
                  <textarea
                    title="Message de maintenance"
                    placeholder="Message de maintenance"
                    rows={3}
                    value={maintModal.message}
                    onChange={(e) => setMaintModal({ ...maintModal, message: e.target.value })}
                    className={INPUT_CLS + " w-full"}
                  />
                </Field>
                <Field label="Retour estimé (optionnel)">
                  <input
                    title="Retour estimé"
                    placeholder="ex: 15h30 HNE"
                    type="text"
                    value={maintModal.eta}
                    onChange={(e) => setMaintModal({ ...maintModal, eta: e.target.value })}
                    className={INPUT_CLS + " w-full"}
                  />
                </Field>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => { setMaintModal(null); setVersion((v) => v + 1); }} className="px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmMaintenance}
                className={`px-5 py-2.5 rounded-lg text-white font-bold text-[13px] uppercase tracking-wider transition-colors ${
                  maintModal.turningOn ? "bg-[#F59E0B] hover:bg-[#D97706]" : "bg-[#22C55E] hover:bg-[#1EA751]"
                }`}
              >
                {maintModal.turningOn ? "Activer" : "Désactiver"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 w-full max-w-[440px] shadow-2xl mx-4">
            <h2 className="font-head text-[16px] font-black text-white uppercase mb-3">
              Supprimer le paramètre
            </h2>
            <p className="text-[13px] text-[#9CA3AF] mb-6">
              Supprimer <code className="text-[#E63946]">{confirmDelete.key}</code>? Cette action est irréversible.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => setConfirmDelete(null)} className="px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">
                Annuler
              </button>
              <button
                type="button"
                onClick={() => deleteSetting(confirmDelete.key)}
                className="px-5 py-2.5 rounded-lg bg-[#E63946] text-white font-bold text-[13px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border ${
            toast.ok ? "border-[#22C55E]/40 text-[#22C55E]" : "border-[#E63946]/40 text-[#E63946]"
          } font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

const INPUT_CLS =
  "bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2 text-[13px] text-white transition-colors focus:outline-none focus:border-[#E63946]/60 hover:border-[#3a4250]";

function audienceLabel(aud: string): string {
  switch (aud) {
    case "COACH": return "Entraîneurs";
    case "RECRUTEUR": return "Recruteurs";
    case "ATHLETE": return "Athlètes";
    default: return "Tous";
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function SettingRow({
  setting,
  isSuperAdmin,
  onSave,
  onDelete,
}: {
  setting: AppSetting;
  isSuperAdmin: boolean;
  onSave: (key: string, value: string, type: SettingType) => Promise<void>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<string>(setting.value ?? "");

  useEffect(() => {
    setDraft(setting.value ?? "");
  }, [setting.value]);

  const changed = draft !== (setting.value ?? "");

  return (
    <div className="px-6 py-4 border-b border-[#2D3748]/40 last:border-b-0 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-white/[0.015] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <code className="text-[12px] font-mono text-[#E63946] break-all">{setting.key}</code>
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.15em] text-[#6b7280]">
            {setting.type}
          </span>
        </div>
        {setting.description && (
          <p className="text-[12px] text-[#9CA3AF] leading-snug">{setting.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 w-full sm:w-[240px] sm:shrink-0 sm:justify-end">
        <div className={setting.type === "BOOLEAN" ? "" : "flex-1"}>
          {setting.type === "BOOLEAN" ? (
            <ToggleSwitch
              checked={draft === "true"}
              onChange={(v) => {
                const nv = v ? "true" : "false";
                setDraft(nv);
                onSave(setting.key, nv, setting.type);
              }}
            />
          ) : setting.type === "JSON" ? (
            <textarea
              title={setting.key}
              placeholder={setting.key}
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => changed && onSave(setting.key, draft, setting.type)}
              className={INPUT_CLS + " w-full font-mono text-[11px]"}
            />
          ) : setting.type === "NUMBER" ? (
            <input
              title={setting.key}
              placeholder={setting.key}
              type="number"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => changed && onSave(setting.key, draft, setting.type)}
              className={INPUT_CLS + " w-full"}
            />
          ) : (
            <input
              title={setting.key}
              placeholder={setting.key}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => changed && onSave(setting.key, draft, setting.type)}
              className={INPUT_CLS + " w-full"}
            />
          )}
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={onDelete}
            title="Supprimer"
            aria-label="Supprimer"
            className="shrink-0 p-2 rounded-lg border border-[#2D3748] text-[#6b7280] hover:text-[#E63946] hover:border-[#E63946]/40 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="switch"
      title={checked ? "Activé" : "Désactivé"}
      aria-label={checked ? "Activé" : "Désactivé"}
      aria-checked={checked ? "true" : "false"}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-[#E63946]/40 focus:ring-offset-2 focus:ring-offset-[#1A1D24] ${
        checked ? "bg-[#22C55E]" : "bg-[#2D3748]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${
          checked ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}
