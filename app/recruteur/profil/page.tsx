"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import SchoolSelect from "@/components/ui/SchoolSelect";

/* ═══════════════════════════════════════════════════════════════
   Recruiter Profile — Form + Live Preview
   Wired to Supabase: users + schools
═══════════════════════════════════════════════════════════════ */

const TITLES = [
  "Entraîneur-chef",
  "Entraîneur adjoint",
  "Coordonnateur recrutement",
  "Responsable des sports",
];

const DIVISIONS = ["Division 1", "Division 2", "Division 3"];

const SPORTS = [
  "Athlétisme", "Badminton", "Baseball", "Basketball", "Cheerleading",
  "Cross-country", "Danse", "Flag football", "Escrime", "Football",
  "Futsal", "Golf", "Gymnastique", "Hockey", "Judo", "Karaté", "Natation",
  "Rugby", "Ski alpin", "Ski de fond", "Soccer", "Softball", "Tennis",
  "Tennis de table", "Ultimate frisbee", "Volleyball", "Water-polo",
];

const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors";
const labelCls = "text-[12px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF] mb-1.5 block";

interface FormData {
  firstName: string;
  lastName: string;
  title: string;
  schoolId: string;
  schoolName: string;
  division: string;
  teamName: string;
  sport: string;
  region: string;
}

export default function RecruiterProfilPage() {
  const [form, setForm] = useState<FormData>({
    firstName: "", lastName: "", title: "", schoolId: "", schoolName: "",
    division: "", teamName: "", sport: "", region: "",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (key: keyof FormData, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  // Load profile + schools
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Load schools for dropdown
      const { data: schoolsData } = await supabase.from("schools").select("id, name").order("name");
      if (schoolsData) setSchools(schoolsData);

      // Load profile
      const { data: profile, error } = await supabase
        .from("users")
        .select("first_name, last_name, role, school_id, photo_url, title, division, team_name, sport, region")
        .eq("id", user.id)
        .single();

      console.log("[Profile load]", { profile, error });

      if (profile) {
        // Get school name
        let schoolName = "";
        if (profile.school_id && schoolsData) {
          const found = schoolsData.find((s: { id: string }) => s.id === profile.school_id);
          schoolName = found?.name || "";
        }

        setForm({
          firstName: (profile.first_name as string) || "",
          lastName: (profile.last_name as string) || "",
          title: (profile.title as string) || "",
          schoolId: (profile.school_id as string) || "",
          schoolName,
          division: (profile.division as string) || "",
          teamName: (profile.team_name as string) || "",
          sport: (profile.sport as string) || "",
          region: (profile.region as string) || "",
        });
        if (profile.photo_url) setAvatarUrl(profile.photo_url as string);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
    if (uploadError) { console.log("[Photo upload error]", uploadError); return; }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    await supabase.from("users").update({ photo_url: urlData.publicUrl }).eq("id", user.id);
    console.log("[Photo upload]", { url: urlData.publicUrl });
    setAvatarUrl(urlData.publicUrl);
  }

  async function removeAvatar() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("users").update({ photo_url: null }).eq("id", user.id);
    setAvatarUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const payload = {
      first_name: form.firstName || "",
      last_name: form.lastName || "",
      school_id: form.schoolId || null,
      title: form.title || null,
      division: form.division || null,
      team_name: form.teamName || null,
      sport: form.sport || null,
      region: form.region || null,
    };
    console.log("[SAVE] user:", user.id, "payload:", payload);

    const { data, error } = await supabase
      .from("users")
      .update(payload)
      .eq("id", user.id)
      .select();

    console.log("[SAVE] result:", data, "error:", error);
    console.log("[SAVE] full result:", JSON.stringify(data));

    if (error) {
      alert("Erreur: " + error.message);
    } else {
      setToast("Profil sauvegardé");
      setTimeout(() => setToast(null), 3000);
    }
    setSaving(false);
  }

  const requiredFilled = form.firstName && form.lastName && form.schoolId;
  const initials = (form.firstName[0] || "") + (form.lastName[0] || "");

  if (loading) {
    return <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto text-[#6b7280]">Chargement...</div>;
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Mon profil</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">Ton identité visible par les coachs</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
          <div className="bg-[#1A1D24] border border-[#2D3748] rounded-lg px-5 py-3 shadow-lg flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
            <span className="text-[13px] font-bold text-white">{toast}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* LEFT: Form */}
        <div className="lg:col-span-3 space-y-5">
          <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6 space-y-5">
            {/* Photo upload */}
            <div>
              <label className={labelCls}>Photo de profil</label>
              <div className="flex items-center gap-4">
                <div
                  className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-[#2D3748] flex items-center justify-center cursor-pointer group transition-all hover:border-[#E63946]/50"
                  style={{ background: "#13151a" }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarUrl ? (
                    <>
                      <img src={avatarUrl} alt="Avatar" className="absolute inset-0 w-full h-full object-cover" />
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
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" title="Photo de profil" />
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[13px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors">
                    {avatarUrl ? "Changer la photo" : "Ajouter une photo"}
                  </button>
                  {avatarUrl && (
                    <button type="button" onClick={removeAvatar} className="text-[12px] text-[#6b7280] hover:text-[#E63946] transition-colors">Supprimer</button>
                  )}
                  <p className="text-[11px] text-[#4B5563]">JPG ou PNG, max 2 Mo</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Prénom *</label>
                <input type="text" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} placeholder="Prénom" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Nom *</label>
                <input type="text" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} placeholder="Nom" className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Titre</label>
              <select title="Titre" value={form.title} onChange={(e) => update("title", e.target.value)} className={inputCls}>
                <option value="">Sélectionner un titre</option>
                {TITLES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>CÉGEP / École *</label>
              <SchoolSelect
                value={form.schoolId || null}
                onChange={(id) => {
                  const name = schools.find(s => s.id === id)?.name || "";
                  setForm(prev => ({ ...prev, schoolId: id, schoolName: name }));
                }}
                filterType="CEGEP"
                placeholder="Rechercher un CÉGEP..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Division</label>
                <select title="Division" value={form.division} onChange={(e) => update("division", e.target.value)} className={inputCls}>
                  <option value="">Sélectionner</option>
                  {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Nom d&apos;équipe</label>
                <input type="text" value={form.teamName} onChange={(e) => update("teamName", e.target.value)} placeholder="ex: Élans" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Sport</label>
                <select title="Sport" value={form.sport} onChange={(e) => update("sport", e.target.value)} className={inputCls}>
                  <option value="">Sélectionner</option>
                  {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Région</label>
                <input type="text" value={form.region} onChange={(e) => update("region", e.target.value)} placeholder="ex: Capitale-Nationale" className={inputCls} />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-6 py-3 font-bold text-[14px] uppercase tracking-wider transition-all hover:bg-[#D42B22] active:scale-95 disabled:opacity-50"
                disabled={!requiredFilled || saving}
              >
                {saving ? "Sauvegarde..." : "Sauvegarder le profil"}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Live preview */}
        <div className="lg:col-span-2">
          <div className="sticky top-8">
            <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-3">Aperçu en temps réel</p>
            <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-[#E63946]/15 border-2 border-[#E63946]/30 flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <span className="text-[20px] font-bold text-[#E63946]">{initials || "?"}</span>
                  )}
                </div>
                <div>
                  <p className="text-[18px] font-bold text-white">{form.firstName || "Prénom"} {form.lastName || "Nom"}</p>
                  <p className="text-[14px] text-[#9CA3AF]">{form.title || "Titre"}</p>
                </div>
              </div>

              <div className="space-y-3 border-t border-[#2D3748] pt-4">
                <div className="flex items-center gap-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22V12h6v10" /></svg>
                  <span className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider w-[60px] shrink-0">CÉGEP</span>
                  <span className="text-[14px] text-[#e0e0e0]">{form.schoolName || "—"}{form.teamName ? ` — ${form.teamName}` : ""}</span>
                </div>
                <div className="flex items-center gap-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
                  <span className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider w-[60px] shrink-0">Division</span>
                  <span className="text-[14px] text-[#e0e0e0]">{form.division || "—"}</span>
                  {form.division === "Division 1" && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#E63946]/15 text-[10px] font-bold text-[#E63946]">D1</span>}
                  {form.division === "Division 2" && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#6B7280]/15 text-[10px] font-bold text-[#6B7280]">D2</span>}
                  {form.division === "Division 3" && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#374151]/30 text-[10px] font-bold text-[#374151]">D3</span>}
                </div>
                <div className="flex items-center gap-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" /></svg>
                  <span className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider w-[60px] shrink-0">Sport</span>
                  <span className="text-[14px] text-[#e0e0e0]">{form.sport || "—"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  <span className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider w-[60px] shrink-0">Région</span>
                  <span className="text-[14px] text-[#e0e0e0]">{form.region || "—"}</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
