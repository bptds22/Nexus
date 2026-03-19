"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { mockDirectorCegep, CEGEP_LIST } from "@/lib/mock";

/* ═══════════════════════════════════════════════════════════════
   Director CÉGEP Settings — /directeur-cegep/parametres
   Left nav + content panel, matching coach/HS director layout.
═══════════════════════════════════════════════════════════════ */

/* ── Style constants ────────────────────────────────────────── */
const labelCls = "block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5";
const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
const selectCls = "bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] outline-none focus:border-[#E63946] transition-colors w-full";

/* ── Sections ─────────────────────────────────────────────── */
type SectionKey = "profil" | "etablissement" | "notifications" | "compte";

const SECTIONS: { key: SectionKey; label: string; icon: React.ReactNode }[] = [
  {
    key: "profil",
    label: "Mon profil",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    key: "etablissement",
    label: "Mon établissement",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  },
  {
    key: "compte",
    label: "Compte & sécurité",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
  },
];

/* ── Notification config ──────────────────────────────────── */
interface NotifRow {
  key: string;
  label: string;
  desc: string;
  inApp: boolean;
  email: boolean;
  emailOnly?: boolean;
}

const DEFAULT_NOTIFS: NotifRow[] = [
  { key: "newRecruit", label: "Nouvelle recrue confirm\u00e9e", desc: "Quand un athl\u00e8te est recrut\u00e9 par un de vos recruteurs", inApp: true, email: true },
  { key: "recruiterInactive", label: "Recruteur inactif (14j+)", desc: "Alerte quand un recruteur ne s\u2019est pas connect\u00e9", inApp: true, email: false },
  { key: "newRecruiter", label: "Nouveau recruteur inscrit", desc: "Quand un recruteur rejoint votre C\u00c9GEP", inApp: true, email: true },
  { key: "weeklyDigest", label: "R\u00e9sum\u00e9 hebdomadaire", desc: "Rapport par courriel chaque lundi", inApp: false, email: true, emailOnly: true },
];

/* ── Toggle (matching coach settings pill style) ────────────── */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-[40px] h-[24px] rounded-full transition-all duration-300 ease-in-out cursor-pointer shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] ${
        checked ? "bg-[#E63946]" : "bg-[#1a1f2e]"
      }`}
    >
      <span
        className={`absolute top-[4px] left-0 w-[16px] h-[16px] rounded-full bg-gradient-to-b from-white to-[#e8e8e8] shadow-[0_1px_3px_rgba(0,0,0,0.35),0_0_0_0.5px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out ${
          checked ? "translate-x-[20px]" : "translate-x-[4px]"
        }`}
      />
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════ */

export default function CegepParametresPage() {
  /* ── Section state ────────────────────────────────────────── */
  const [section, setSection] = useState<SectionKey>("profil");

  /* ── Form state ───────────────────────────────────────────── */
  const [firstName, setFirstName] = useState(mockDirectorCegep.firstName);
  const [lastName, setLastName] = useState(mockDirectorCegep.lastName);
  const [email, setEmail] = useState(mockDirectorCegep.email);
  const [phone, setPhone] = useState(mockDirectorCegep.phone ?? "");
  const [roleTitle, setRoleTitle] = useState(mockDirectorCegep.roleTitle);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [cegepId, setCegepId] = useState(mockDirectorCegep.establishmentId);

  const [notifs, setNotifs] = useState<NotifRow[]>(DEFAULT_NOTIFS);

  /* ── Toast ────────────────────────────────────────────────── */
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* ── Helpers ──────────────────────────────────────────────── */
  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  const toggleNotif = useCallback(
    (key: string, field: "inApp" | "email") => {
      setNotifs((prev) =>
        prev.map((n) => (n.key === key ? { ...n, [field]: !n[field] } : n)),
      );
    },
    [],
  );

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Param&egrave;tres
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          G&eacute;rez votre compte et les param&egrave;tres de votre C&Eacute;GEP.
        </p>
      </div>

      {/* Layout: nav + content */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left nav */}
        <div className="lg:w-[240px] shrink-0">
          <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
            {SECTIONS.map((s) => {
              const isActive = section === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-[14px] font-bold tracking-[0.08em] uppercase whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-[#E63946]/12 text-[#E63946]"
                      : "text-[#8a8d96] hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className={isActive ? "text-[#E63946]" : "text-[#6b7280]"}>{s.icon}</span>
                  {s.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content panel */}
        <div className="flex-1 min-w-0">
          <div className="bg-[#111317]/60 backdrop-blur-sm rounded-xl border border-[#1e2128] p-6 sm:p-8">

            {/* ─── Mon profil ──────────────────────────────── */}
            {section === "profil" && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-head text-lg font-black text-white uppercase tracking-tight">
                    Mon profil
                  </h2>
                  <p className="text-[13px] text-[#6B7280] mt-1">
                    Informations personnelles et identifiants.
                  </p>
                </div>

                {/* Avatar upload */}
                <div className="flex items-center gap-4">
                  <div
                    className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-[#2D3748] flex items-center justify-center cursor-pointer group transition-all hover:border-[#E63946]/50"
                    style={{ background: "#13151a" }}
                    onClick={() => avatarInputRef.current?.click()}
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
                  <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                  <div className="flex flex-col gap-1.5">
                    <button type="button" onClick={() => avatarInputRef.current?.click()} className="text-[13px] font-bold text-[#E63946] hover:text-[#D93C3C] transition-colors text-left">
                      {avatarUrl ? "Changer la photo" : "Ajouter une photo"}
                    </button>
                    {avatarUrl && (
                      <button type="button" onClick={() => { setAvatarUrl(null); if (avatarInputRef.current) avatarInputRef.current.value = ""; }} className="text-[12px] text-[#6b7280] hover:text-[#E63946] transition-colors text-left">
                        Supprimer
                      </button>
                    )}
                    <p className="text-[11px] text-[#4B5563]">JPG ou PNG, max 2 Mo</p>
                  </div>
                </div>

                <div className="space-y-5">
                  {/* Prénom + Nom */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Pr&eacute;nom</label>
                      <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Nom</label>
                      <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
                    </div>
                  </div>

                  {/* Courriel */}
                  <div>
                    <label className={labelCls}>Courriel</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                  </div>

                  {/* Téléphone + Titre */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>T&eacute;l&eacute;phone</label>
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(418) 555-0000" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Titre / R&ocirc;le</label>
                      <input type="text" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} className={inputCls} />
                    </div>
                  </div>

                  {/* Change password */}
                  <button
                    type="button"
                    onClick={() => showToast("Fonctionnalit\u00e9 bient\u00f4t disponible")}
                    className="border border-[#2D3748] text-[#9CA3AF] hover:border-[#E63946] hover:text-white rounded-lg px-5 py-2.5 text-[13px] font-bold uppercase tracking-[0.1em] transition-colors"
                  >
                    Modifier le mot de passe
                  </button>
                </div>

                {/* Save */}
                <div className="flex justify-end pt-4 border-t border-[#1e2128]">
                  <button
                    type="button"
                    onClick={() => showToast("Modifications enregistr\u00e9es")}
                    className="bg-[#E63946] hover:bg-[#D42B22] text-white px-6 py-2.5 rounded-lg font-head font-bold text-[13px] uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            )}

            {/* ─── Mon établissement ────────────────────────── */}
            {section === "etablissement" && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-head text-lg font-black text-white uppercase tracking-tight">
                    Mon &eacute;tablissement
                  </h2>
                  <p className="text-[13px] text-[#6B7280] mt-1">
                    Informations sur votre C&Eacute;GEP.
                  </p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className={labelCls}>C&Eacute;GEP</label>
                    <select
                      value={cegepId}
                      onChange={(e) => setCegepId(e.target.value)}
                      className={selectCls}
                      title="S\u00e9lectionnez votre C\u00c9GEP"
                    >
                      {CEGEP_LIST.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Région (auto from CÉGEP) */}
                  <div>
                    <label className={labelCls}>R&eacute;gion</label>
                    <input
                      type="text"
                      value={CEGEP_LIST.find((c) => c.id === cegepId)?.region ?? mockDirectorCegep.region}
                      readOnly
                      className={`${inputCls} bg-[#0d0f13] text-[#6B7280] cursor-not-allowed`}
                    />
                  </div>
                </div>

                {/* Save */}
                <div className="flex justify-end pt-4 border-t border-[#1e2128]">
                  <button
                    type="button"
                    onClick={() => showToast("Modifications enregistr\u00e9es")}
                    className="bg-[#E63946] hover:bg-[#D42B22] text-white px-6 py-2.5 rounded-lg font-head font-bold text-[13px] uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            )}

            {/* ─── Notifications ────────────────────────────── */}
            {section === "notifications" && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-head text-lg font-black text-white uppercase tracking-tight">
                    Notifications
                  </h2>
                  <p className="text-[13px] text-[#6B7280] mt-1">
                    Choisissez comment vous &ecirc;tes notifi&eacute;.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px]">
                    <thead>
                      <tr className="border-b border-[#2A2D35]">
                        <th className="text-left text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B7280] pb-3 w-[50%]">Type</th>
                        <th className="text-center text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B7280] pb-3 w-[25%]">In-App</th>
                        <th className="text-center text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B7280] pb-3 w-[25%]">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notifs.map((n) => (
                        <tr key={n.key} className="border-b border-[#1e2128]">
                          <td className="py-4">
                            <p className="text-[14px] text-white font-medium">{n.label}</p>
                            <p className="text-[12px] text-[#6B7280]">{n.desc}</p>
                          </td>
                          <td className="py-4">
                            <div className="flex justify-center">
                              {n.emailOnly ? (
                                <span className="text-[13px] text-[#4a4d56]">&mdash;</span>
                              ) : (
                                <Toggle checked={n.inApp} onChange={() => toggleNotif(n.key, "inApp")} />
                              )}
                            </div>
                          </td>
                          <td className="py-4">
                            <div className="flex justify-center">
                              <Toggle checked={n.email} onChange={() => toggleNotif(n.key, "email")} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Save */}
                <div className="flex justify-end pt-4 border-t border-[#1e2128]">
                  <button
                    type="button"
                    onClick={() => showToast("Modifications enregistr\u00e9es")}
                    className="bg-[#E63946] hover:bg-[#D42B22] text-white px-6 py-2.5 rounded-lg font-head font-bold text-[13px] uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            )}

            {/* ─── Compte & sécurité ───────────────────────── */}
            {section === "compte" && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-head text-lg font-black text-white uppercase tracking-tight">
                    Compte & s&eacute;curit&eacute;
                  </h2>
                  <p className="text-[13px] text-[#6B7280] mt-1">
                    Actions sur votre compte. Proc&eacute;dez avec prudence.
                  </p>
                </div>

                {/* Deactivate */}
                <div className="rounded-lg border border-[#2A2D35] p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[14px] text-white font-medium">D&eacute;sactiver le compte</p>
                    <p className="text-[12px] text-[#6B7280] mt-0.5">Emp&ecirc;chera tous les recruteurs de votre C&Eacute;GEP d&apos;acc&eacute;der &agrave; la plateforme.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => showToast("Veuillez contacter le support")}
                    className="shrink-0 border border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B] hover:text-black rounded-lg px-5 py-2.5 text-[13px] font-bold uppercase tracking-[0.1em] transition-colors"
                  >
                    D&eacute;sactiver
                  </button>
                </div>

                {/* Delete */}
                <div className="rounded-lg border border-[#E63946]/30 p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[14px] text-white font-medium">Supprimer mon compte</p>
                    <p className="text-[12px] text-[#6B7280] mt-0.5">Action irr&eacute;versible. Toutes vos donn&eacute;es seront supprim&eacute;es.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => showToast("Fonctionnalit\u00e9 bient\u00f4t disponible")}
                    className="shrink-0 border border-[#E63946] text-[#E63946] hover:bg-[#E63946] hover:text-white rounded-lg px-5 py-2.5 text-[13px] font-bold uppercase tracking-[0.1em] transition-colors"
                  >
                    Supprimer
                  </button>
                </div>

                {/* Export */}
                <div className="rounded-lg border border-[#2A2D35] p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[14px] text-white font-medium">Exporter mes donn&eacute;es</p>
                    <p className="text-[12px] text-[#6B7280] mt-0.5">T&eacute;l&eacute;chargez toutes vos donn&eacute;es au format CSV.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => showToast("Fonctionnalit\u00e9 bient\u00f4t disponible")}
                    className="shrink-0 border border-[#2D3748] text-[#9CA3AF] hover:border-[#E63946] hover:text-white rounded-lg px-5 py-2.5 text-[13px] font-bold uppercase tracking-[0.1em] transition-colors"
                  >
                    Exporter
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Toast ──────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[120] flex items-center gap-2.5 bg-[#22C55E] text-white rounded-lg px-5 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.4)] animate-[nxDropIn_0.2s_ease-out]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span className="text-[14px] font-bold">{toast}</span>
        </div>
      )}
    </div>
  );
}
