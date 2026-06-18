"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachProfilEditMobile — coach profile edit drill-down.

   Accessed from CoachParametresMobile's "Modifier mon profil" NavRow
   (route /coach/parametres/profil). Edits :
     - Avatar (users.avatar_url)
     - Prénom / Nom (users.first_name / last_name)
     - Téléphone (users.phone)
     - Sport (school_coaches.sport — separate table)
     - Langue préférée (users.preferred_language)

   Email is read-only (auth-managed).

   Pattern mirrors the desktop ProfileSection but in mobile iOS
   Settings idiom : labeled blocks inside the dark page, sticky
   bottom Save button when dirty. No tier gating.
═══════════════════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { triggerHaptic } from "@/components/shared/settings";

interface ProfileForm {
  firstName: string;
  lastName: string;
  email: string;        // read-only
  phone: string;
  language: string;
  sport: string;
  avatarUrl: string;
}

const EMPTY: ProfileForm = {
  firstName: "", lastName: "", email: "", phone: "",
  language: "fr", sport: "", avatarUrl: "",
};

const LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
];

export function CoachProfilEditMobile() {
  const router = useRouter();
  const toast = useMobileToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [orig, setOrig] = useState<ProfileForm>(EMPTY);
  const [sports, setSports] = useState<string[]>([]);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  /* ── Load profile + sport from school_coaches + sports list ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: u } = await supabase
        .from("users")
        .select("first_name, last_name, email, phone, avatar_url, preferred_language, school_id")
        .eq("id", user.id)
        .single();

      const sid = (u?.school_id as string | null) || null;
      setSchoolId(sid);

      let sport = "";
      if (sid) {
        const { data: sc } = await supabase
          .from("school_coaches")
          .select("sport")
          .eq("user_id", user.id)
          .eq("school_id", sid)
          .limit(1)
          .maybeSingle();
        sport = (sc?.sport as string) || "";
      }

      const { data: sportsList } = await supabase
        .from("sports")
        .select("nom")
        .order("nom");

      if (cancelled) return;

      const seed: ProfileForm = {
        firstName: (u?.first_name as string) || "",
        lastName: (u?.last_name as string) || "",
        email: (u?.email as string) || user.email || "",
        phone: (u?.phone as string) || "",
        language: (u?.preferred_language as string) || "fr",
        sport,
        avatarUrl: (u?.avatar_url as string) || "",
      };
      setForm(seed);
      setOrig(seed);
      setSports((sportsList || []).map((s: { nom: string }) => s.nom));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(orig),
    [form, orig],
  );

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    triggerHaptic("Light");
    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase
        .storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) { toast.error({ message: "Téléversement échoué", detail: upErr.message }); return; }
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      update("avatarUrl", pub.publicUrl);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!dirty || saving) return;
    triggerHaptic("Medium");
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: uErr } = await supabase
        .from("users")
        .update({
          first_name: form.firstName.trim() || null,
          last_name: form.lastName.trim() || null,
          phone: form.phone.trim() || null,
          preferred_language: form.language,
          avatar_url: form.avatarUrl || null,
        })
        .eq("id", user.id);
      if (uErr) { toast.error({ message: "Échec sauvegarde", detail: uErr.message }); return; }

      // Sport lives on school_coaches (per-school assignment).
      if (schoolId && form.sport !== orig.sport) {
        const { error: scErr } = await supabase
          .from("school_coaches")
          .update({ sport: form.sport || null })
          .eq("user_id", user.id)
          .eq("school_id", schoolId);
        if (scErr) { toast.error({ message: "Échec sauvegarde du sport", detail: scErr.message }); return; }
      }

      setOrig(form);
      toast.success({ message: "Profil mis à jour" });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    triggerHaptic("Light");
    router.back();
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden bg-[#111317] text-white nx-mobile-pb-tabbar">
        <div className="px-4 pt-10 pb-3 text-[#6b7280] text-[14px]">Chargement…</div>
      </div>
    );
  }

  const initials = `${form.firstName[0] || ""}${form.lastName[0] || ""}`.toUpperCase() || "?";

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#111317] text-white nx-mobile-pb-tabbar">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#111317]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="h-11 flex items-center px-4">
          <button
            type="button"
            aria-label="Retour"
            onClick={handleBack}
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/[0.08] text-[#8a8d96]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="flex-1 text-center font-head text-[17px] font-black text-white uppercase tracking-tight pr-9">
            Profil
          </h1>
        </div>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center pt-6 pb-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative w-24 h-24 rounded-full overflow-hidden bg-[#1A1D24] border border-white/[0.08] flex items-center justify-center active:opacity-80"
        >
          {form.avatarUrl ? (
            // Plain img on purpose — no Next/Image inside Capacitor static export.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[28px] font-bold text-[#9CA3AF]">{initials}</span>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-[13px] text-[#E63946] font-semibold mt-3"
        >
          Changer la photo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />
      </div>

      {/* Fields */}
      <div className="px-4 pt-4 space-y-4">
        <Field label="Prénom">
          <input
            type="text"
            value={form.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            className="w-full bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 h-12 text-[16px] text-white placeholder:text-[#4a4d56] focus:outline-none focus:border-[#E63946]/40"
          />
        </Field>

        <Field label="Nom">
          <input
            type="text"
            value={form.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            className="w-full bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 h-12 text-[16px] text-white placeholder:text-[#4a4d56] focus:outline-none focus:border-[#E63946]/40"
          />
        </Field>

        <Field label="Courriel" hint="Non modifiable depuis cet écran">
          <input
            type="email"
            value={form.email}
            readOnly
            className="w-full bg-[#1A1D24]/60 border border-white/[0.04] rounded-2xl px-4 h-12 text-[16px] text-[#9CA3AF]"
          />
        </Field>

        <Field label="Téléphone">
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="(514) 555-1234"
            className="w-full bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 h-12 text-[16px] text-white placeholder:text-[#4a4d56] focus:outline-none focus:border-[#E63946]/40"
          />
        </Field>

        <Field label="Sport principal">
          <select
            value={form.sport}
            onChange={(e) => update("sport", e.target.value)}
            className="w-full bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 h-12 text-[16px] text-white focus:outline-none focus:border-[#E63946]/40"
          >
            <option value="">—</option>
            {sports.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>

        <Field label="Langue">
          <select
            value={form.language}
            onChange={(e) => update("language", e.target.value)}
            className="w-full bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 h-12 text-[16px] text-white focus:outline-none focus:border-[#E63946]/40"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="h-24" />

      {/* Sticky save bar (only when dirty) */}
      {dirty && (
        <div
          className="fixed bottom-0 inset-x-0 z-20 bg-[#111317]/95 backdrop-blur-md border-t border-white/[0.06] px-4 pt-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 rounded-2xl bg-[#E63946] text-white text-[15px] font-semibold active:bg-[#D42B22] disabled:opacity-60"
          >
            {saving ? "Sauvegarde…" : "Enregistrer"}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold tracking-[0.18em] uppercase text-[#6b7280] mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[#4a4d56] mt-1.5">{hint}</p>}
    </div>
  );
}
