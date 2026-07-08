"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { RecruiterSettings, RecruiterVisibility } from "@/lib/types/models";

/* ─────────────────────────────────────────────────────────────────
   ConfidentialiteSection — Privacy, Loi 25 rights, RPRP
───────────────────────────────────────────────────────────────── */

interface Props {
  form: RecruiterSettings;
  original: RecruiterSettings;
  onUpdateVisibility: (vis: RecruiterVisibility) => void;
  onSave: () => void;
  onSectionChange?: (section: string) => void;
  signupDate?: string;
  consentPrivacyDate?: string;
  consentDataDate?: string;
  consentMarketingDate?: string | null;
  marketingConsent?: boolean;
  onMarketingConsentChange?: (v: boolean) => void;
}

export default function ConfidentialiteSection({ form, original, onUpdateVisibility, onSave, onSectionChange, signupDate, consentPrivacyDate, consentDataDate, consentMarketingDate, marketingConsent = false, onMarketingConsentChange }: Props) {
  const dirty = true; // Always allow save for consent changes
  const [requestSent, setRequestSent] = useState(false);
  const [exporting, setExporting] = useState(false);

  /* ── Demander (data access request → admin_notifications) ── */
  async function handleDataRequest() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("admin_notifications").insert({
      type: "SYSTEM",
      title: "Demande d'accès aux données",
      message: `L'utilisateur ${user.email} a demandé une copie de ses données personnelles (Loi 25 — droit d'accès).`,
      related_user_id: user.id,
    });

    setRequestSent(true);
    alert("Votre demande a été envoyée. Vous recevrez vos données par courriel dans un délai de 30 jours.");
  }

  /* ── Exporter (download all user data as JSON) ── */
  async function handleExport() {
    setExporting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, favoritesRes, pipelineRes, notesRes, listsRes, reviewsRes, messagesRes] = await Promise.all([
        supabase.from("users").select("*").eq("id", user.id).single(),
        supabase.from("recruiter_favorites").select("athlete_id, created_at").eq("recruiter_id", user.id),
        supabase.from("recruiter_pipeline").select("athlete_id, stage, created_at").eq("recruiter_id", user.id),
        supabase.from("recruiter_notes").select("athlete_id, content, created_at").eq("recruiter_id", user.id),
        supabase.from("recruiter_lists").select("name, description, created_at").eq("recruiter_id", user.id),
        supabase.from("coach_reviews").select("coach_id, note_globale, commentaire, created_at").eq("recruiter_id", user.id),
        supabase.from("messages").select("content, created_at").eq("sender_id", user.id),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        user_email: user.email,
        profile: profileRes.data,
        favorites: favoritesRes.data || [],
        pipeline: pipelineRes.data || [],
        notes: notesRes.data || [],
        lists: listsRes.data || [],
        reviews: reviewsRes.data || [],
        messages: messagesRes.data || [],
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexus-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
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


      {/* Consents */}
      <div className={cardCls}>
        {sectionHeader("Mes consentements")}
        <div className="space-y-4">
          {/* Privacy policy — required, read-only */}
          <div className="flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#22C55E" stroke="none" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
            <div>
              <p className="text-[13px] font-bold text-white">Politique de confidentialité</p>
              <p className="text-[11px] text-[#6b7280]">Acceptée le {consentPrivacyDate || signupDate || "lors de l'inscription"}</p>
              <Link href="/confidentialite" target="_blank" className="text-[11px] font-bold text-[#E63946] hover:text-[#ff4d5a] transition-colors">Lire la politique →</Link>
            </div>
          </div>

          {/* Data collection — required, read-only */}
          <div className="flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#22C55E" stroke="none" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
            <div>
              <p className="text-[13px] font-bold text-white">Collecte et traitement des données</p>
              <p className="text-[11px] text-[#6b7280]">Accepté le {consentDataDate || signupDate || "lors de l'inscription"}</p>
              <Link href="/collecte-donnees" target="_blank" className="text-[11px] font-bold text-[#E63946] hover:text-[#ff4d5a] transition-colors">Lire les détails →</Link>
            </div>
          </div>

          {/* Marketing — toggleable */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {marketingConsent ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#22C55E" stroke="none" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" className="shrink-0 mt-0.5"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
              )}
              <div>
                <p className="text-[13px] font-bold text-white">Communications marketing</p>
                <p className="text-[11px] text-[#6b7280]">{marketingConsent ? `Accepté le ${consentMarketingDate || "récemment"}` : "Non accepté"}</p>
                <Link href="/communications-marketing" target="_blank" className="text-[11px] font-bold text-[#E63946] hover:text-[#ff4d5a] transition-colors">Lire les détails →</Link>
              </div>
            </div>
            <button
              type="button"
              aria-label={marketingConsent ? "Désactiver" : "Activer"}
              onClick={() => onMarketingConsentChange?.(!marketingConsent)}
              className={`w-9 h-5 rounded-full transition-colors relative shrink-0 mt-1 ${marketingConsent ? "bg-[#E63946]" : "bg-[#2D3748]"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${marketingConsent ? "left-[18px]" : "left-0.5"}`} />
            </button>
          </div>

          <p className="text-[10px] text-[#4a4d56] italic mt-2">Les consentements requis (politique et collecte) ne peuvent être retirés. Pour supprimer vos données, utilisez la section Zone Danger.</p>
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
            <button type="button" onClick={handleDataRequest} disabled={requestSent} className={`${btnOutline} ${requestSent ? "opacity-50 cursor-not-allowed" : ""}`}>{requestSent ? "Envoyée ✓" : "Demander"}</button>
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
            <button type="button" onClick={handleExport} disabled={exporting} className={`${btnOutline} ${exporting ? "opacity-50 cursor-not-allowed" : ""}`}>{exporting ? "Export en cours..." : "Exporter"}</button>
          </div>

          <div className="h-px bg-[#2D3748]" />

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-[18px] mt-0.5">🗑️</span>
              <div>
                <p className="text-[13px] font-bold text-white">Droit à l&apos;effacement</p>
                <p className="text-[11px] text-[#6b7280] mt-0.5 max-w-sm">Supprimer définitivement votre compte et toutes vos données — immédiat et irréversible.</p>
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
            <a href="mailto:confidentialite@nexussports.ca" className="text-[12px] text-[#9CA3AF] hover:text-white transition-colors">confidentialite@nexussports.ca</a>
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
