"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { CoachProfile } from "../_data/mockSettingsData";

/* ─────────────────────────────────────────────────────────────────
   ProfileSection — Coach profile form + live preview card
───────────────────────────────────────────────────────────────── */

const label = "text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-1.5";
const input = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";

/* ─────────────────────────────────────────────────────────────────
   Sprint coach-profilesection-fix — Statut "rôle" désormais READ-ONLY,
   dérivé de la source de vérité (users.is_school_admin +
   profile_data.admin_type), plus de la colonne school_coaches.role
   qu'un coach pouvait s'auto-écrire ici. Le statut de responsable
   est porté par admin_claims modéré (Loi 25).
─────────────────────────────────────────────────────────────────── */
function deriveRoleLabel(isSchoolAdmin: boolean, adminType: string | null | undefined): string {
  if (isSchoolAdmin && adminType === "owner") return "Directeur sportif";
  if (isSchoolAdmin && adminType === "interim") return "Directeur sportif intérimaire";
  return "Entraîneur";
}

export default function ProfileSection() {
  const [form, setForm] = useState<CoachProfile>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "",
    sport: "",
    avatarInitials: "",
  });
  const [sports, setSports] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coachEntryId, setCoachEntryId] = useState<string | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState<string>("fr");
  const [userId, setUserId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Load user profile — incluant is_school_admin + profile_data
      // pour dériver le label du rôle responsable (Loi 25, plus de
      // self-promote depuis ce form).
      setUserId(user.id);
      const { data: profile, error: profileErr } = await supabase
        .from("users")
        .select("first_name, last_name, email, phone, avatar_url, preferred_language, is_school_admin, profile_data")
        .eq("id", user.id)
        .single();
      if (profile?.preferred_language) setPreferredLanguage(profile.preferred_language);

      // Load coach entry — role retiré du SELECT, plus écrit ici.
      const { data: coachEntry, error: coachErr } = await supabase
        .from("school_coaches")
        .select("id, sport")
        .eq("coach_id", user.id)
        .single();

      // Load sports list
      const { data: sportsList, error: sportsErr } = await supabase
        .from("sports")
        .select("nom")
        .order("nom");

      if (profile) {
        const firstName = profile.first_name || "";
        const lastName = profile.last_name || "";
        const adminType = (profile.profile_data as { admin_type?: string } | null)?.admin_type ?? null;
        const isSchoolAdmin = profile.is_school_admin === true;
        setForm({
          firstName,
          lastName,
          email: profile.email || user.email || "",
          phone: profile.phone || "",
          role: deriveRoleLabel(isSchoolAdmin, adminType),
          sport: coachEntry?.sport || "",
          avatarInitials: `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase(),
        });
        if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
      }

      if (coachEntry) setCoachEntryId(coachEntry.id);
      if (sportsList) setSports(sportsList.map((s: { nom: string }) => s.nom));
      setLoading(false);
    }
    loadData();
  }, []);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  function update(field: keyof CoachProfile, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "firstName" || field === "lastName") {
        const f = field === "firstName" ? value : prev.firstName;
        const l = field === "lastName" ? value : prev.lastName;
        next.avatarInitials = `${f[0] || ""}${l[0] || ""}`.toUpperCase();
      }
      return next;
    });
    setSaved(false);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setError("Non authentifié"); return; }

    // Update users table
    const { error: userErr } = await supabase
      .from("users")
      .update({
        first_name: form.firstName,
        last_name: form.lastName,
        phone: form.phone,
      })
      .eq("id", user.id);

    // Update school_coaches table — UNIQUEMENT le sport. Le rôle
    // (school_coaches.role) n'est PLUS auto-éditable depuis ce form
    // (sprint coach-profilesection-fix). Le statut de responsable est
    // porté par admin_claims modéré (Loi 25).
    if (coachEntryId) {
      const { error: coachErr } = await supabase
        .from("school_coaches")
        .update({ sport: form.sport })
        .eq("id", coachEntryId);

      if (coachErr) { setSaving(false); setError("Erreur lors de la sauvegarde du sport."); return; }
    }

    if (userErr) { setSaving(false); setError("Erreur lors de la sauvegarde du profil."); return; }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section header */}
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Profil</h2>
        <p className="text-[14px] text-[#6b7280] mt-1">Tes informations personnelles en tant que coach.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Form */}
        <div className="xl:col-span-2 space-y-5">
          {/* Photo upload */}
          <div className="flex items-center gap-4">
            <div
              className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-[#2D3748] flex items-center justify-center cursor-pointer group transition-all hover:border-[#E63946]/50"
              style={{ background: "#13151a" }}
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarUrl ? (
                <>
                  <Image src={avatarUrl} alt="Avatar" fill className="object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 group-hover:text-[#E63946] transition-colors">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" className="group-hover:stroke-[#E63946] transition-colors">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span className="text-[9px] font-bold text-[#6b7280] uppercase tracking-wider group-hover:text-[#E63946]">Photo</span>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            <div className="flex flex-col gap-1.5">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[13px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors text-left">
                {avatarUrl ? "Changer la photo" : "Ajouter une photo"}
              </button>
              {avatarUrl && (
                <button type="button" onClick={() => { setAvatarUrl(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-[12px] text-[#6b7280] hover:text-[#E63946] transition-colors text-left">
                  Supprimer
                </button>
              )}
              <p className="text-[11px] text-[#4B5563]">JPG ou PNG, max 2 Mo</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className={label}>Prénom</p>
              <input type="text" title="Prénom" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} className={input} />
            </div>
            <div>
              <p className={label}>Nom</p>
              <input type="text" title="Nom" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} className={input} />
            </div>
          </div>

          <div>
            <p className={label}>Courriel</p>
            <input type="email" value={form.email} readOnly className={`${input} opacity-60 cursor-not-allowed`} />
          </div>

          <div>
            <p className={label}>Téléphone</p>
            <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} className={input} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className={label}>Rôle</p>
              <div className={`${input} opacity-70 cursor-not-allowed flex items-center`}>
                {form.role || "Entraîneur"}
              </div>
              <p className="text-[11px] text-[#6b7280] mt-1 leading-snug">
                Le statut de responsable est géré via une demande de responsabilité validée par Nexus.
              </p>
            </div>
            <div>
              <p className={label}>Sport</p>
              <select
                title="Sport"
                value={form.sport}
                onChange={(e) => update("sport", e.target.value)}
                className={input}
              >
                <option value="">— Sélectionner —</option>
                {sports.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Language preference */}
          <div>
            <p className={label}>Langue de l&apos;interface</p>
            <select
              title="Langue de l'interface"
              value={preferredLanguage}
              onChange={async (e) => {
                const value = e.target.value;
                setPreferredLanguage(value);
                if (!userId) return;
                const supabase = createClient();
                const { error: langErr } = await supabase
                  .from("users")
                  .update({ preferred_language: value })
                  .eq("id", userId);
              }}
              className={input}
            >
              <option value="fr">Fran&#231;ais</option>
              <option value="en">English</option>
            </select>
            <p className="text-[11px] text-[#4a4d56] mt-1">English — disponible prochainement</p>
          </div>

          {/* Save button */}
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
                Modifications enregistrées
              </span>
            )}
            {error && (
              <span className="text-[14px] font-semibold text-[#EF4444]">
                {error}
              </span>
            )}
          </div>
        </div>

        {/* Live preview card */}
        <div className="xl:col-span-1">
          <p className={`${label} mb-3`}>Aperçu</p>
          <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6 flex flex-col items-center text-center">
            <div className="relative w-16 h-16 rounded-full overflow-hidden bg-[#E63946]/15 border-2 border-[#E63946]/30 flex items-center justify-center mb-4">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="Avatar" fill className="object-cover" />
              ) : (
                <span className="text-[18px] font-black text-[#E63946]">
                  {form.avatarInitials || "??"}
                </span>
              )}
            </div>
            <p className="font-head text-[16px] font-black text-white uppercase tracking-tight">
              {form.firstName} {form.lastName}
            </p>
            <p className="text-[12px] text-[#9CA3AF] mt-1">{form.role}</p>
            <p className="text-[12px] text-[#6b7280] mt-0.5">{form.sport}</p>

            <div className="w-full h-px bg-[#2D3748] my-4" />

            <div className="space-y-2 w-full text-left">
              <div className="flex items-center gap-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span className="text-[12px] text-[#9CA3AF] truncate">{form.email}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                </svg>
                <span className="text-[12px] text-[#9CA3AF]">{form.phone}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
