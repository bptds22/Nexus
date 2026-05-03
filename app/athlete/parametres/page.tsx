"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SubscriptionSection from "@/components/subscription/SubscriptionSection";
import AthletePlayerCard from "@/components/shared/AthletePlayerCard";
import CoachPicker from "@/components/coach/CoachPicker";
import { createClient } from "@/lib/supabase/client";
import { loadAthleteRaw, mapToRecruiterView } from "@/app/coach/athletes/_data/loadAthleteFromSupabase";
import type { AthleteProfileRecruiterView } from "@/lib/types/models";
import { isMinor } from "@/lib/utils/age";
import { toPng } from "html-to-image";

/* ═══════════════════════════════════════════════════════════════
   Paramètres — Athlete settings
   Sub-nav pattern matching admin/coach/recruiter settings pages
═══════════════════════════════════════════════════════════════ */

type SectionKey = "compte" | "abonnement" | "carte" | "notifications" | "confidentialite";

const SECTIONS: { key: SectionKey; label: string; icon: React.ReactNode }[] = [
  {
    key: "compte", label: "Compte",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  },
  {
    key: "abonnement", label: "Abonnement",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>,
  },
  {
    key: "carte", label: "Carte de joueur",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 7h4v4H7z" /><path d="M14 7h3M14 11h3M7 15h10M7 19h10" /></svg>,
  },
  {
    key: "notifications", label: "Notifications",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>,
  },
  {
    key: "confidentialite", label: "Confidentialité",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  },
];

const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
const labelCls = "block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5";

const NOTIF_PREFS = [
  { key: "profile_viewed", label: "Profil consulté par un recruteur", default: true },
  { key: "new_favorite", label: "Ajouté aux favoris", default: true },
  { key: "suggestion_approved", label: "Suggestion approuvée", default: true },
  { key: "suggestion_rejected", label: "Suggestion rejetée", default: true },
  { key: "coach_update", label: "Profil mis à jour par ton coach", default: true },
  { key: "completion_reminder", label: "Rappel de complétion (hebdomadaire)", default: true },
  { key: "milestone", label: "Milestones (vues, favoris)", default: true },
];

export default function ParametresPage() {
  const [section, setSection] = useState<SectionKey>("compte");
  const [toast, setToast] = useState<string | null>(null);
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [notifToggles, setNotifToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIF_PREFS.map((p) => [p.key, p.default]))
  );
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [profile, setProfile] = useState<{
    email: string;
    schoolId: string;
    schoolName: string;
    coachId: string | null;
    coachName: string;
    coachPhotoUrl: string | null;
    parentalConsentGiven: boolean;
    parentalConsentDate: string | null;
    dateOfBirth: string | null;
    partnerOptIn: boolean;
    partnerOptInDate: string | null;
    partnerParentalConsent: boolean;
  } | null>(null);

  // Media partner opt-in toggle state
  const [savingPartnerOptIn, setSavingPartnerOptIn] = useState(false);

  // Coach selection modal state
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [showRemoveCoachConfirm, setShowRemoveCoachConfirm] = useState(false);
  const [pickerSelection, setPickerSelection] = useState<string | null>(null);
  const [savingCoach, setSavingCoach] = useState(false);

  // Social card export
  const [cardAthlete, setCardAthlete] = useState<AthleteProfileRecruiterView | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const captureRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const loadProfile = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: row } = await supabase
      .from("athletes")
      .select(`
        school_id,
        coach_id,
        date_naissance,
        consentement_parental,
        consentement_parental_date,
        partner_visibility_opt_in,
        partner_visibility_opted_in_at,
        partner_visibility_parental_consent,
        schools!school_id(name),
        users!athletes_coach_id_fkey(first_name, last_name, photo_url)
      `)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!row) return;
    const schoolRel = Array.isArray(row.schools) ? row.schools[0] : row.schools;
    const coachRel = Array.isArray(row.users) ? row.users[0] : row.users;
    setProfile({
      email: user.email ?? "",
      schoolId: (row.school_id as string) ?? "",
      schoolName: schoolRel?.name ?? "",
      coachId: (row.coach_id as string | null) ?? null,
      coachName: coachRel ? `${coachRel.first_name ?? ""} ${coachRel.last_name ?? ""}`.trim() : "",
      coachPhotoUrl: (coachRel?.photo_url as string | null) ?? null,
      parentalConsentGiven: row.consentement_parental === true,
      parentalConsentDate: row.consentement_parental_date ?? null,
      dateOfBirth: (row.date_naissance as string | null) ?? null,
      partnerOptIn: row.partner_visibility_opt_in === true,
      partnerOptInDate: (row.partner_visibility_opted_in_at as string | null) ?? null,
      partnerParentalConsent: row.partner_visibility_parental_consent === true,
    });
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (section !== "carte" || cardAthlete || cardLoading) return;
    (async () => {
      setCardLoading(true);
      setCardError(null);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setCardError("Session expirée"); return; }
        const { data: row } = await supabase
          .from("athletes")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!row?.id) { setCardError("Profil athlète introuvable"); return; }
        const result = await loadAthleteRaw(row.id as string);
        if (!result?.data) { setCardError("Impossible de charger le profil"); return; }
        setCardAthlete(mapToRecruiterView(result.data as Record<string, unknown>));
      } catch (e) {
        console.error("[carte] load failed:", e);
        setCardError("Erreur de chargement");
      } finally {
        setCardLoading(false);
      }
    })();
  }, [section, cardAthlete, cardLoading]);

  async function downloadCard() {
    if (!captureRef.current || !cardAthlete) return;
    setDownloading(true);
    try {
      // Wait for fonts so the captured PNG has the right typography.
      if (typeof document !== "undefined" && document.fonts) {
        await document.fonts.ready;
      }
      const dataUrl = await toPng(captureRef.current, {
        // AthletePlayerCard format="publication" renders at exactly
        // 1080×1350 (IG portrait); pixelRatio 1 produces the PNG
        // at that target resolution natively.
        pixelRatio: 1,
        cacheBust: true,
        backgroundColor: undefined, // transparent
        style: {
          animation: "none",
          transition: "none",
        },
      });
      const link = document.createElement("a");
      const safe = `${cardAthlete.firstName}-${cardAthlete.lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      link.download = `nexus-carte-${safe}.png`;
      link.href = dataUrl;
      link.click();
      showToast("Carte téléchargée");
    } catch (e) {
      console.error("[carte] export failed:", e);
      showToast("Échec du téléchargement");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto">
      <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight mb-1">Paramètres</h1>
      <p className="text-[14px] text-[#9CA3AF] mb-6">Gère ton compte et tes préférences</p>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sub-nav */}
        <div className="lg:w-[220px] shrink-0">
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {SECTIONS.map((s) => (
              <button key={s.key} type="button" onClick={() => setSection(s.key)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-[13px] font-bold uppercase tracking-[0.12em] transition-all whitespace-nowrap ${
                  section === s.key ? "bg-[#E63946]/12 text-[#E63946]" : "text-[#8a8d96] hover:text-white hover:bg-white/5"
                }`}>
                <span className={section === s.key ? "text-[#E63946]" : "text-[#6b7280]"}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content panel */}
        <div className="flex-1 bg-[#111317]/60 backdrop-blur-sm rounded-xl border border-[#1e2128] p-6 sm:p-8">

          {/* ── COMPTE ────────────────────────────────────────── */}
          {section === "compte" && (
            <div className="space-y-8">
              <div>
                <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-4">Informations du compte</h2>
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Courriel</label>
                    <div className="flex items-center gap-3">
                      <span className="text-[14px] text-[#9CA3AF]">{profile?.email || "..."}</span>
                      <button type="button" onClick={() => showToast("Modifier le courriel — POC")} className="text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors">Modifier</button>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Mot de passe</label>
                    {showPwdForm ? (
                      <div className="space-y-3 max-w-sm">
                        <input type="password" placeholder="Mot de passe actuel" className={inputCls} />
                        <input type="password" placeholder="Nouveau mot de passe" className={inputCls} />
                        <input type="password" placeholder="Confirmer" className={inputCls} />
                        <div className="flex gap-3">
                          <button type="button" onClick={() => { setShowPwdForm(false); showToast("Mot de passe modifié (POC)"); }} className="px-4 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold rounded-lg transition-colors">Sauvegarder</button>
                          <button type="button" onClick={() => setShowPwdForm(false)} className="text-[12px] text-[#6b7280] hover:text-white transition-colors">Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-[14px] text-[#9CA3AF]">••••••••</span>
                        <button type="button" onClick={() => setShowPwdForm(true)} className="text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors">Modifier</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-[#2D3748]/40 pt-6">
                <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-4">Mon école</h2>
                <div className="flex items-center justify-between py-2 mb-4">
                  <span className="text-[13px] text-[#9CA3AF]">École</span>
                  <span className="text-[14px] font-bold text-white">{profile?.schoolName || "..."}</span>
                </div>
                <p className="text-[11px] text-[#4a4d56] italic">Pour changer d&apos;école, contacte le support.</p>
              </div>

              <div className="border-t border-[#2D3748]/40 pt-6">
                <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-4">Mon coach</h2>
                {profile?.coachId ? (
                  <div className="bg-[#13151a] border border-white/5 rounded-lg p-4 flex items-center gap-4">
                    {profile.coachPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.coachPhotoUrl}
                        alt={profile.coachName}
                        className="w-14 h-14 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-[#2D3748] flex items-center justify-center text-[14px] font-bold text-white">
                        {profile.coachName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-[14px] font-bold text-white">{profile.coachName}</p>
                      <p className="text-[12px] text-[#6b7280]">Mon coach actuel</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPickerSelection(profile.coachId);
                          setShowCoachModal(true);
                        }}
                        className="px-3 py-1.5 text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors"
                      >
                        Changer
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRemoveCoachConfirm(true)}
                        className="px-3 py-1.5 text-[12px] font-bold text-[#6b7280] hover:text-[#EF4444] transition-colors"
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#13151a] border border-white/5 rounded-lg p-4">
                    <p className="text-[13px] text-[#9CA3AF] mb-3">Tu n&apos;as pas encore de coach.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setPickerSelection(null);
                        setShowCoachModal(true);
                      }}
                      className="px-4 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold rounded-lg transition-colors"
                    >
                      Sélectionner un coach
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t border-[#2D3748]/40 pt-6">
                <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-4">Langue de l&apos;interface</h2>
                <select
                  title="Langue de l'interface"
                  defaultValue="fr"
                  onChange={async (e) => {
                    const value = e.target.value;
                    const supabase = createClient();
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;
                    const { error } = await supabase
                      .from("users")
                      .update({ preferred_language: value })
                      .eq("id", user.id);
                    console.log("[Athlete parametres] preferred_language saved:", value, error);
                    showToast("Préférence de langue sauvegardée");
                  }}
                  className={`${inputCls} max-w-[260px]`}
                >
                  <option value="fr">Fran&#231;ais</option>
                  <option value="en">English</option>
                </select>
                <p className="text-[11px] text-[#4a4d56] mt-2">English — disponible prochainement</p>
              </div>
            </div>
          )}

          {/* ── ABONNEMENT ───────────────────────────────────── */}
          {section === "abonnement" && <SubscriptionSection portal="athlete" />}

          {/* ── NOTIFICATIONS ─────────────────────────────────── */}
          {section === "notifications" && (
            <div>
              <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-4">Préférences de notifications</h2>
              <div className="space-y-1">
                {NOTIF_PREFS.map((pref) => (
                  <div key={pref.key} className="flex items-center justify-between py-3 border-b border-[#2D3748]/30 last:border-0">
                    <span className="text-[13px] text-[#9CA3AF]">{pref.label}</span>
                    <button type="button" onClick={() => { setNotifToggles((prev) => ({ ...prev, [pref.key]: !prev[pref.key] })); showToast("Préférence sauvegardée (POC)"); }}
                      className={`relative w-10 h-6 rounded-full transition-colors ${notifToggles[pref.key] ? "bg-[#22C55E]" : "bg-[#2D3748]"}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${notifToggles[pref.key] ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CARTE ─────────────────────────────────────────── */}
          {section === "carte" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-1">Ma carte de joueur</h2>
                <p className="text-[13px] text-[#9CA3AF]">
                  Télécharge ta carte Nexus au format PNG (fond transparent) pour la partager sur Instagram, TikTok ou Facebook.
                </p>
              </div>

              {cardLoading && <p className="text-[13px] text-[#9CA3AF]">Chargement de ta carte...</p>}
              {cardError && <p className="text-[13px] text-[#E63946]">{cardError}</p>}

              {cardAthlete && (() => {
                const missing: string[] = [];
                if (!cardAthlete.photoUrl) missing.push("photo");
                if (!cardAthlete.primaryPosition) missing.push("position");
                if (!cardAthlete.jerseyNumber) missing.push("numéro");
                if (!cardAthlete.schoolName) missing.push("école");
                if (!cardAthlete.graduationYear) missing.push("promotion");
                return (
                  <>
                    {/* On-screen preview — same rotation as the exported PNG */}
                    <div className="bg-[#13151a] border border-white/5 rounded-xl p-8 flex justify-center">
                      <div style={{ width: 400, height: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ transform: "rotate(-3deg)", transformOrigin: "center center" }}>
                          <AthletePlayerCard a={cardAthlete} />
                        </div>
                      </div>
                    </div>

                    {missing.length > 0 && (
                      <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
                        <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <p className="text-[13px] text-amber-300">
                          Profil incomplet : {missing.join(", ")} manquant{missing.length > 1 ? "s" : ""}. Complète ton profil pour une carte optimale.
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={downloadCard}
                        disabled={downloading}
                        className="px-5 py-2.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {downloading ? "Génération..." : "Télécharger (PNG)"}
                      </button>
                      <span className="text-[12px] text-[#6b7280]">Fond transparent · haute résolution</span>
                    </div>

                    {/* Off-screen full-size render for html-to-image capture.
                        AthletePlayerCard format="publication" is intrinsically
                        1080×1350. The .nx-capture-clean class disables the
                        editorial tilt transforms (.nx-v30-card / .nx-v30-ticket)
                        on descendants so the resulting PNG is axis-aligned
                        with no clipped ticket. The on-screen card preview
                        above keeps its tilt — it's purely visual flair. */}
                    <div
                      aria-hidden="true"
                      className="nx-capture-clean"
                      style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none", zIndex: -1 }}
                    >
                      <div ref={captureRef}>
                        <AthletePlayerCard a={cardAthlete} format="publication" />
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ── CONFIDENTIALITÉ ────────────────────────────────── */}
          {section === "confidentialite" && (
            <div className="space-y-8">
              <div>
                <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-4">Visibilité du profil</h2>
                <div className="bg-[#13151a] border border-white/5 rounded-lg p-4">
                  <p className="text-[13px] text-[#9CA3AF] leading-relaxed">Ton profil est visible par les recruteurs CÉGEP vérifiés sur la plateforme Nexus. Seul ton coach peut modifier la visibilité de ton profil.</p>
                  <div className="flex items-center gap-2 mt-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                    <span className="text-[13px] font-bold text-[#22C55E]">Profil visible</span>
                  </div>
                  <p className="text-[11px] text-[#4a4d56] mt-2">Pour masquer ton profil, contacte ton coach.</p>
                </div>
              </div>

              <div className="border-t border-[#2D3748]/40 pt-6">
                <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-4">Visibilité publique</h2>
                <div className="bg-[#13151a] border border-white/5 rounded-lg p-4 space-y-4">
                  <div>
                    <p className="text-[14px] font-bold text-white">Partenaires médias</p>
                    <p className="text-[13px] text-[#9CA3AF] leading-relaxed mt-1">
                      Permettre aux partenaires médias approuvés (journalistes sportifs, pages spécialisées) de télécharger ma carte Nexus pour publication. Ma carte contient mon nom, ma photo, mon école et mon sport.
                    </p>
                  </div>

                  {(() => {
                    if (!profile) return null;
                    const minor = isMinor(profile.dateOfBirth);
                    const consentReady = !minor || profile.partnerParentalConsent;
                    const toggleEnabled = consentReady && !savingPartnerOptIn;

                    return (
                      <>
                        {minor && (
                          <label className="flex items-start gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={profile.partnerParentalConsent}
                              onChange={async (e) => {
                                const supabase = createClient();
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) return;
                                const checked = e.target.checked;
                                // If parent unchecks while opt-in is active, also turn opt-in off.
                                const updates: Record<string, unknown> = { partner_visibility_parental_consent: checked };
                                if (!checked && profile.partnerOptIn) {
                                  updates.partner_visibility_opt_in = false;
                                  updates.partner_visibility_opted_in_at = null;
                                }
                                const { error } = await supabase.from("athletes").update(updates).eq("user_id", user.id);
                                if (error) { console.error("[Partner consent]", error); showToast("Erreur lors de la sauvegarde"); return; }
                                showToast(checked ? "Consentement parental enregistré" : "Consentement retiré");
                                await loadProfile();
                              }}
                              className="sr-only"
                            />
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${profile.partnerParentalConsent ? "bg-[#E63946] border-[#E63946]" : "border-[#4a4d56] group-hover:border-[#6b7280]"}`}>
                              {profile.partnerParentalConsent && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                              )}
                            </div>
                            <span className="text-[12px] text-[#9CA3AF] leading-snug">
                              J&apos;ai reçu le consentement parental pour permettre l&apos;utilisation de ma carte Nexus par des partenaires médias.
                            </span>
                          </label>
                        )}

                        {consentReady ? (
                          <div className="flex items-center justify-between py-2">
                            <div className="flex-1 pr-4">
                              <p className="text-[13px] font-semibold text-white">Permettre l&apos;utilisation de ma carte par les partenaires</p>
                              {profile.partnerOptIn && profile.partnerOptInDate && (
                                <p className="text-[11px] text-[#22C55E] mt-1">
                                  Activé le {new Date(profile.partnerOptInDate).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={!toggleEnabled}
                              aria-label="Permettre l'utilisation de ma carte par les partenaires"
                              onClick={async () => {
                                if (!toggleEnabled) return;
                                setSavingPartnerOptIn(true);
                                const supabase = createClient();
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) { setSavingPartnerOptIn(false); return; }
                                const next = !profile.partnerOptIn;
                                const updates: Record<string, unknown> = next
                                  ? {
                                      partner_visibility_opt_in: true,
                                      partner_visibility_opted_in_at: new Date().toISOString(),
                                      partner_visibility_parental_consent: minor ? true : profile.partnerParentalConsent,
                                    }
                                  : {
                                      partner_visibility_opt_in: false,
                                      partner_visibility_opted_in_at: null,
                                    };
                                const { error } = await supabase.from("athletes").update(updates).eq("user_id", user.id);
                                if (error) {
                                  console.error("[Partner opt-in]", error);
                                  showToast("Erreur lors de la sauvegarde");
                                  setSavingPartnerOptIn(false);
                                  return;
                                }
                                showToast(next ? "Visibilité publique activée" : "Visibilité publique désactivée");
                                setSavingPartnerOptIn(false);
                                await loadProfile();
                              }}
                              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${profile.partnerOptIn ? "bg-[#22C55E]" : "bg-[#2D3748]"} ${!toggleEnabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${profile.partnerOptIn ? "left-[22px]" : "left-0.5"}`} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2.5 py-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0110 0v4" />
                            </svg>
                            <p className="text-[13px] text-[#9CA3AF] leading-relaxed">
                              Cochez le consentement parental ci-dessus pour activer la visibilité partenaire.
                            </p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="border-t border-[#2D3748]/40 pt-6">
                <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-4">Consentement parental</h2>
                <div className="bg-[#13151a] border border-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
                    <span className="text-[13px] font-bold text-[#22C55E]">
                      {profile?.parentalConsentGiven && profile.parentalConsentDate
                        ? `Consentement parental confirmé le ${new Date(profile.parentalConsentDate).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}${profile.coachName ? ` par ${profile.coachName}` : ""}`
                        : "Consentement en attente"}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#9CA3AF] leading-relaxed">Le consentement peut être retiré à tout moment. Ton profil sera immédiatement désactivé et invisible.</p>
                  <button type="button" onClick={() => setShowRevokeModal(true)}
                    className="mt-3 px-4 py-2 border border-[#E63946] text-[#E63946] text-[12px] font-bold rounded-lg hover:bg-[#E63946]/10 transition-colors">
                    Retirer le consentement
                  </button>
                </div>
              </div>

              <div className="border-t border-[#E63946]/20 pt-6">
                <div className="bg-[#13151a] border border-[#E63946]/20 rounded-lg p-5">
                  <h3 className="font-head text-[14px] font-black text-[#E63946] uppercase tracking-tight mb-2">Supprimer mon compte</h3>
                  <p className="text-[12px] text-[#9CA3AF] leading-relaxed mb-3">
                    Cette action enverra une demande de suppression à ton coach et à l&apos;administrateur. Ton profil sera désactivé immédiatement et supprimé après 30 jours.
                  </p>
                  <button type="button" onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold rounded-lg transition-colors">
                    Demander la suppression
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Revoke consent modal */}
      {showRevokeModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRevokeModal(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">Retirer le consentement?</h3>
            <p className="text-[13px] text-[#9CA3AF] mt-2 leading-relaxed">Ton profil sera immédiatement désactivé et invisible pour les recruteurs. Ton coach et le directeur sportif seront notifiés.</p>
            <p className="text-[11px] text-[#6b7280] mt-2">Cette action peut être annulée en contactant ton coach.</p>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button type="button" onClick={() => setShowRevokeModal(false)} className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">Annuler</button>
              <button type="button" onClick={() => { setShowRevokeModal(false); showToast("Consentement retiré (POC)"); }} className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors">Retirer le consentement</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete account modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">Supprimer ton compte?</h3>
            <p className="text-[13px] text-[#9CA3AF] mt-2 leading-relaxed">Ton profil sera désactivé et tu perdras l&apos;accès à ton espace athlète. La suppression définitive sera effectuée après 30 jours.</p>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button type="button" onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">Annuler</button>
              <button type="button" onClick={() => { setShowDeleteModal(false); showToast("Demande de suppression envoyée (POC)"); }} className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors">Confirmer la suppression</button>
            </div>
          </div>
        </div>
      )}

      {/* Coach selection modal */}
      {showCoachModal && profile && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !savingCoach && setShowCoachModal(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <h3 className="font-head text-lg font-black text-white uppercase tracking-tight mb-1">
              {profile.coachId ? "Changer de coach" : "Sélectionner un coach"}
            </h3>
            <p className="text-[13px] text-[#9CA3AF] mb-5">
              Choisis ton coach actuel à {profile.schoolName}.
            </p>
            <CoachPicker
              schoolId={profile.schoolId}
              selectedCoachId={pickerSelection}
              onChange={setPickerSelection}
            />
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#2D3748]/40">
              <button
                type="button"
                onClick={() => setShowCoachModal(false)}
                className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors"
                disabled={savingCoach}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={async () => {
                  setSavingCoach(true);
                  const supabase = createClient();
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) { setSavingCoach(false); return; }
                  const { error } = await supabase
                    .from("athletes")
                    .update({ coach_id: pickerSelection })
                    .eq("user_id", user.id);
                  if (error) {
                    console.error("[Coach update]", error);
                    showToast("Impossible de mettre à jour le coach");
                    setSavingCoach(false);
                    return;
                  }
                  showToast(pickerSelection ? "Coach mis à jour" : "Coach retiré");
                  setShowCoachModal(false);
                  setSavingCoach(false);
                  await loadProfile();
                }}
                className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors disabled:opacity-50"
                disabled={savingCoach || pickerSelection === profile.coachId}
              >
                {savingCoach ? "Enregistrement..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove-coach confirmation modal */}
      {showRemoveCoachConfirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !savingCoach && setShowRemoveCoachConfirm(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight mb-2">Retirer ton coach&nbsp;?</h3>
            <p className="text-[13px] text-[#9CA3AF] leading-relaxed mb-5">
              Tu n&apos;auras plus de coach assigné. Tu pourras en sélectionner un autre plus tard.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRemoveCoachConfirm(false)}
                className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors"
                disabled={savingCoach}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={async () => {
                  setSavingCoach(true);
                  const supabase = createClient();
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) { setSavingCoach(false); return; }
                  const { error } = await supabase
                    .from("athletes")
                    .update({ coach_id: null })
                    .eq("user_id", user.id);
                  if (error) {
                    console.error("[Coach remove]", error);
                    showToast("Impossible de retirer le coach");
                    setSavingCoach(false);
                    return;
                  }
                  showToast("Coach retiré");
                  setShowRemoveCoachConfirm(false);
                  setSavingCoach(false);
                  await loadProfile();
                }}
                className="px-5 py-2 bg-[#EF4444] hover:bg-[#DC2626] text-white text-[13px] font-bold rounded-lg transition-colors disabled:opacity-50"
                disabled={savingCoach}
              >
                {savingCoach ? "Suppression..." : "Retirer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
          <div className="bg-[#1A1D24] border border-[#2D3748] rounded-lg px-5 py-3 shadow-lg flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
            <span className="text-[13px] font-bold text-white">{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
