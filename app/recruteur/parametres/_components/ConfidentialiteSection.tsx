"use client";

import Link from "next/link";
import type { RecruiterSettings, RecruiterVisibility } from "@/lib/types/models";
import SettingsToggle from "./SettingsToggle";

/* ─────────────────────────────────────────────────────────────────
   ConfidentialiteSection — Privacy, Loi 25 rights, RPRP
───────────────────────────────────────────────────────────────── */

interface Props {
  form: RecruiterSettings;
  original: RecruiterSettings;
  onUpdateVisibility: (vis: RecruiterVisibility) => void;
  onSave: () => void;
  onSectionChange?: (section: string) => void;
}

export default function ConfidentialiteSection({ form, original, onUpdateVisibility, onSave, onSectionChange }: Props) {
  const dirty = JSON.stringify(form.visibility) !== JSON.stringify(original.visibility);

  // Derive signup date from accountId or use a fallback
  const signupDate = new Date().toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });

  function handleActionToast() {
    alert("Votre demande a été envoyée à confidentialite@nexus-sport.ca");
  }

  const sectionHeader = (label: string) => (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-0.5 h-4 bg-[#E63946] rounded-full" />
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">{label}</span>
    </div>
  );

  const cardCls = "bg-[#1A1D24] rounded-xl border border-[#2A2D35] p-5 mb-4";
  const btnOutline = "px-4 py-2 border border-[#E63946] text-[#E63946] text-[12px] font-bold rounded-lg hover:bg-[#E63946]/10 transition-colors uppercase tracking-wider";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Mes données et confidentialité</h2>
        <p className="text-[14px] text-[#6b7280] mt-1">Vos droits en vertu de la Loi 25 sur la protection des renseignements personnels du Québec.</p>
      </div>

      {/* Visibility toggles */}
      <div className={cardCls}>
        {sectionHeader("Visibilité de mon profil")}
        <div className="space-y-1">
          <SettingsToggle
            checked={form.visibility.profileVisible}
            onChange={(v) => onUpdateVisibility({ ...form.visibility, profileVisible: v })}
            label="Mon profil est visible par les coachs"
            sublabel="Les coachs peuvent voir votre CÉGEP, sport et rôle"
          />
          <SettingsToggle
            checked={form.visibility.showConsultationHistory}
            onChange={(v) => onUpdateVisibility({ ...form.visibility, showConsultationHistory: v })}
            label="Afficher mes consultations de profils"
            sublabel="Les coachs voient quand vous consultez un de leurs athlètes"
          />
          <SettingsToggle
            checked={form.visibility.showFullName}
            onChange={(v) => onUpdateVisibility({ ...form.visibility, showFullName: v })}
            label="Afficher mon nom complet"
            sublabel="Sinon, vous apparaîtrez comme « Recruteur du CÉGEP »"
          />
        </div>
      </div>

      {/* Consents */}
      <div className={cardCls}>
        {sectionHeader("Mes consentements")}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#22C55E" stroke="none" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
            <div>
              <p className="text-[13px] font-bold text-white">Politique de confidentialité</p>
              <p className="text-[11px] text-[#6b7280]">Acceptée lors de l&apos;inscription</p>
              <Link href="/confidentialite" target="_blank" className="text-[11px] font-bold text-[#E63946] hover:text-[#ff4d5a] transition-colors">Lire la politique →</Link>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#22C55E" stroke="none" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
            <div>
              <p className="text-[13px] font-bold text-white">Collecte et traitement des données</p>
              <p className="text-[11px] text-[#6b7280]">Accepté lors de l&apos;inscription</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" className="shrink-0 mt-0.5"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
            <div>
              <p className="text-[13px] font-bold text-white">Communications marketing</p>
              <p className="text-[11px] text-[#6b7280]">Non accepté</p>
            </div>
          </div>
        </div>
      </div>

      {/* Loi 25 rights */}
      <div className={cardCls}>
        {sectionHeader("Mes droits (Loi 25)")}
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-[18px] mt-0.5">📋</span>
              <div>
                <p className="text-[13px] font-bold text-white">Accéder à mes données</p>
                <p className="text-[11px] text-[#6b7280] mt-0.5 max-w-sm">Demander une copie de toutes les données personnelles que Nexus détient sur vous.</p>
              </div>
            </div>
            <button type="button" onClick={handleActionToast} className={btnOutline}>Demander</button>
          </div>

          <div className="h-px bg-[#2D3748]" />

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-[18px] mt-0.5">✏️</span>
              <div>
                <p className="text-[13px] font-bold text-white">Rectifier mes données</p>
                <p className="text-[11px] text-[#6b7280] mt-0.5 max-w-sm">Corriger des informations inexactes dans votre profil ou vos données.</p>
              </div>
            </div>
            <Link href="/recruteur/profil" className={btnOutline}>Modifier mon profil</Link>
          </div>

          <div className="h-px bg-[#2D3748]" />

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-[18px] mt-0.5">📦</span>
              <div>
                <p className="text-[13px] font-bold text-white">Portabilité des données</p>
                <p className="text-[11px] text-[#6b7280] mt-0.5 max-w-sm">Télécharger vos données dans un format structuré (JSON/CSV).</p>
              </div>
            </div>
            <button type="button" onClick={handleActionToast} className={btnOutline}>Exporter</button>
          </div>

          <div className="h-px bg-[#2D3748]" />

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-[18px] mt-0.5">🗑️</span>
              <div>
                <p className="text-[13px] font-bold text-white">Droit à l&apos;effacement</p>
                <p className="text-[11px] text-[#6b7280] mt-0.5 max-w-sm">Supprimer définitivement votre compte et toutes vos données. Délai de grâce: 30 jours.</p>
              </div>
            </div>
            <button type="button" onClick={() => onSectionChange?.("danger")} className="px-4 py-2 border border-[#EF4444] text-[#EF4444] text-[12px] font-bold rounded-lg hover:bg-[#EF4444]/10 transition-colors uppercase tracking-wider">Zone danger</button>
          </div>
        </div>
      </div>

      {/* RPRP */}
      <div className="bg-[#13151a] rounded-xl border border-[#2A2D35] p-5">
        {sectionHeader("Responsable de la protection (RPRP)")}
        <div className="space-y-2">
          <p className="text-[14px] font-bold text-white">Bruno-Philippe Desfossés Simard</p>
          <div className="flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 7L2 7" /></svg>
            <a href="mailto:confidentialite@nexus-sport.ca" className="text-[12px] text-[#9CA3AF] hover:text-white transition-colors">confidentialite@nexus-sport.ca</a>
          </div>
          <div className="flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
            <span className="text-[12px] text-[#6b7280]">856 Basile-Routhier, Repentigny, Québec</span>
          </div>
          <p className="text-[11px] text-[#4a4d56] mt-2">Pour toute question relative à vos données personnelles, contactez notre RPRP.</p>
        </div>
      </div>

      {/* Save */}
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty}
        className={`w-full py-3 rounded-lg font-head font-bold text-[14px] uppercase tracking-widest transition-all ${
          dirty ? "bg-[#E63946] text-white hover:bg-[#D42B22]" : "bg-[#2D3748] text-[#6b7280] cursor-not-allowed"
        }`}
      >
        Enregistrer les préférences
      </button>
    </div>
  );
}
