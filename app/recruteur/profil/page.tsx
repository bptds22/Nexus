"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { RECRUITER_PROFILE } from "../_data/mockRecruiterProfile";

/* ═══════════════════════════════════════════════════════════════
   Recruiter Profile — Form + Live Preview
═══════════════════════════════════════════════════════════════ */

const TITLES = [
  "Entraîneur-chef",
  "Entraîneur adjoint",
  "Coordonnateur recrutement",
  "Responsable des sports",
];

const CEGEPS = [
  "CÉGEP Garneau", "CÉGEP du Vieux Montréal", "CÉGEP Limoilou", "CÉGEP Saint-Jean-sur-Richelieu",
  "Collège André-Grasset", "CÉGEP de Sherbrooke", "CÉGEP de Trois-Rivières", "CÉGEP André-Laurendeau",
  "CÉGEP Saint-Laurent", "CÉGEP de Jonquière", "CÉGEP de l'Outaouais", "CÉGEP Édouard-Montpetit",
  "CÉGEP de Victoriaville", "CÉGEP de Drummondville", "CÉGEP Beauce-Appalaches", "CÉGEP de Lévis",
  "CÉGEP de Sainte-Foy", "CÉGEP de Rimouski", "Collège de Valleyfield", "CÉGEP de Granby",
  "Collège Montmorency", "CÉGEP de l'Abitibi-Témiscamingue", "CÉGEP de Chicoutimi", "CÉGEP de Matane",
  "CÉGEP de Sept-Îles", "CÉGEP de Baie-Comeau", "Collège Laflèche", "Collège Dawson",
  "Collège John Abbott", "Vanier College", "Champlain College", "Heritage College",
];

const DIVISIONS = ["Division 1", "Division 2", "Division 3"];

const SPORTS = [
  "Football", "Volleyball", "Basketball", "Soccer", "Hockey",
  "Cross-country", "Natation", "Athlétisme", "Badminton", "Rugby",
];

const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors";
const labelCls = "text-[12px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF] mb-1.5 block";

interface FormData {
  firstName: string;
  lastName: string;
  title: string;
  cegep: string;
  division: string;
  teamName: string;
  sport: string;
  region: string;
}

export default function RecruiterProfilPage() {
  const [form, setForm] = useState<FormData>({
    firstName: RECRUITER_PROFILE.firstName,
    lastName: RECRUITER_PROFILE.lastName,
    title: RECRUITER_PROFILE.title,
    cegep: RECRUITER_PROFILE.cegep,
    division: RECRUITER_PROFILE.division,
    teamName: RECRUITER_PROFILE.teamName,
    sport: RECRUITER_PROFILE.sport,
    region: RECRUITER_PROFILE.region,
  });

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (key: keyof FormData, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  function removeAvatar() {
    setAvatarUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const requiredFilled = form.firstName && form.lastName && form.title && form.cegep && form.division && form.sport;
  const initials = (form.firstName[0] || "") + (form.lastName[0] || "");

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Mon profil</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">Ton identité visible par les coachs</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* LEFT: Form (60%) */}
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
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[13px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors"
                  >
                    {avatarUrl ? "Changer la photo" : "Ajouter une photo"}
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={removeAvatar}
                      className="text-[12px] text-[#6b7280] hover:text-[#E63946] transition-colors"
                    >
                      Supprimer
                    </button>
                  )}
                  <p className="text-[11px] text-[#4B5563]">JPG ou PNG, max 2 Mo</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Prénom *</label>
                <input type="text" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Nom *</label>
                <input type="text" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Titre *</label>
              <select value={form.title} onChange={(e) => update("title", e.target.value)} className={inputCls}>
                <option value="">Sélectionner un titre</option>
                {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>CÉGEP *</label>
              <select value={form.cegep} onChange={(e) => update("cegep", e.target.value)} className={inputCls}>
                <option value="">Sélectionner un CÉGEP</option>
                {CEGEPS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Division *</label>
                <select value={form.division} onChange={(e) => update("division", e.target.value)} className={inputCls}>
                  <option value="">Sélectionner</option>
                  {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Nom d&apos;équipe</label>
                <input type="text" value={form.teamName} onChange={(e) => update("teamName", e.target.value)} placeholder="ex: Élans" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Sport *</label>
                <select value={form.sport} onChange={(e) => update("sport", e.target.value)} className={inputCls}>
                  <option value="">Sélectionner</option>
                  {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Région</label>
                <input type="text" value={form.region} onChange={(e) => update("region", e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                className="flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-6 py-3 font-bold text-[14px] uppercase tracking-wider transition-all hover:bg-[#D42B22] active:scale-95 disabled:opacity-50"
                disabled={!requiredFilled}
              >
                Sauvegarder le profil
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Live preview (40%) */}
        <div className="lg:col-span-2">
          <div className="sticky top-8">
            <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-3">Aperçu en temps réel</p>
            <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6">
              {/* Avatar */}
              <div className="flex items-center gap-4 mb-5">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-[#E63946]/15 border-2 border-[#E63946]/30 flex items-center justify-center">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="Avatar" fill className="object-cover" />
                  ) : (
                    <span className="text-[20px] font-bold text-[#E63946]">{initials || "?"}</span>
                  )}
                </div>
                <div>
                  <p className="text-[18px] font-bold text-white">
                    {form.firstName || "Prénom"} {form.lastName || "Nom"}
                  </p>
                  <p className="text-[14px] text-[#9CA3AF]">{form.title || "Titre"}</p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3 border-t border-[#2D3748] pt-4">
                <div className="flex items-center gap-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  <span className="text-[14px] text-[#e0e0e0]">{form.cegep || "—"}{form.teamName ? ` — ${form.teamName}` : ""}</span>
                </div>
                <div className="flex items-center gap-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span className="text-[14px] text-[#e0e0e0]">{form.division || "—"}</span>
                  {form.division === "Division 1" && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#E63946]/15 text-[10px] font-bold text-[#E63946]">D1</span>
                  )}
                  {form.division === "Division 2" && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#6B7280]/15 text-[10px] font-bold text-[#6B7280]">D2</span>
                  )}
                  {form.division === "Division 3" && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#374151]/30 text-[10px] font-bold text-[#374151]">D3</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                  </svg>
                  <span className="text-[14px] text-[#e0e0e0]">{form.sport || "—"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="text-[14px] text-[#e0e0e0]">{form.region || "—"}</span>
                </div>
              </div>

              {/* Verified badge */}
              {requiredFilled && (
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#2D3748]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#3B82F6" stroke="none">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                  <span className="text-[12px] font-bold text-[#3B82F6]">Profil vérifié</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
