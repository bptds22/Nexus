"use client";

import type { RecruiterSettings } from "@/lib/types/models";

/* ─────────────────────────────────────────────────────────────────
   CompteSection — Mon compte (avatar, name, email, phone, password)
───────────────────────────────────────────────────────────────── */

const labelCls = "block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5";
const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";

interface Props {
  form: RecruiterSettings;
  original: RecruiterSettings;
  onUpdate: <K extends keyof RecruiterSettings>(key: K, value: RecruiterSettings[K]) => void;
  onSave: () => void;
  onPasswordModal: () => void;
}

export default function CompteSection({ form, original, onUpdate, onSave, onPasswordModal }: Props) {
  const dirty = form.firstName !== original.firstName || form.lastName !== original.lastName || (form.phone ?? "") !== (original.phone ?? "");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Mon compte</h2>
        <p className="text-[14px] text-[#6b7280] mt-1">Informations de connexion et identité du compte Nexus.</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div className="relative group shrink-0">
          {form.avatarUrl ? (
            <img src={form.avatarUrl} alt="Avatar" className="w-[80px] h-[80px] rounded-full object-cover border-2 border-[#2a2d36]" />
          ) : (
            <div className="w-[80px] h-[80px] rounded-full bg-[#13151a] border-2 border-dashed border-[#2a2d36] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            </div>
          )}
          <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" />
            </svg>
            <input type="file" accept="image/*" className="hidden" title="Téléverser une photo"
              onChange={(e) => { const f = e.target.files?.[0]; if (f && f.size <= 2 * 1024 * 1024) onUpdate("avatarUrl", URL.createObjectURL(f)); }} />
          </label>
        </div>
        <div>
          <p className="text-[14px] font-bold text-white">Photo de profil</p>
          <p className="text-[12px] text-[#4a4d56] mt-0.5">JPG ou PNG, max 2 Mo</p>
          {form.avatarUrl && (
            <button type="button" onClick={() => onUpdate("avatarUrl", "")} className="text-[12px] text-[#E63946] mt-1 hover:underline">Supprimer</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl">
        <div>
          <label className={labelCls}>Prénom <span className="text-[#E63946]">*</span></label>
          <input type="text" value={form.firstName} maxLength={50}
            onChange={(e) => onUpdate("firstName", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Nom <span className="text-[#E63946]">*</span></label>
          <input type="text" value={form.lastName} maxLength={50}
            onChange={(e) => onUpdate("lastName", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Courriel</label>
          <input type="email" value={form.email} disabled className={`${inputCls} opacity-60 cursor-not-allowed`} />
          <p className="text-[12px] text-[#4a4d56] mt-1">Pour modifier votre courriel, contactez le support.</p>
        </div>
        <div>
          <label className={labelCls}>Téléphone</label>
          <input type="tel" value={form.phone ?? ""} placeholder="(514) 555-0123"
            onChange={(e) => onUpdate("phone", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Mot de passe</label>
          <button type="button" onClick={onPasswordModal}
            className="w-full bg-transparent border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#9CA3AF] hover:border-[#4a4d56] hover:text-white transition-colors text-left">
            Modifier le mot de passe
          </button>
        </div>
        <div>
          <label className={labelCls}>Langue</label>
          <div className="flex items-center gap-2">
            <input type="text" value="Français" disabled className={`${inputCls} opacity-60 cursor-not-allowed flex-1`} />
            <span className="px-2 py-0.5 text-[9px] font-bold tracking-[0.15em] uppercase bg-[#2a2d36]/60 text-[#6B7280] rounded border border-[#2a2d36] shrink-0">Bientôt</span>
          </div>
        </div>
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
