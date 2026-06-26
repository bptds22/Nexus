"use client";

import { useState, useEffect } from "react";
import type { RecruiterSettings } from "@/lib/types/models";
import { createClient } from "@/lib/supabase/client";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { deleteMyAccount } from "@/lib/auth/deleteAccount";
import { RecruteurParametresMobile } from "@/components/shared/RecruteurParametresMobile";
import RecruiterSettingsNav, { type SectionKey } from "./_components/RecruiterSettingsNav";
import CompteSection from "./_components/CompteSection";
import EtablissementSection from "./_components/EtablissementSection";
import RecrutementSection from "./_components/RecrutementSection";
import NotificationsSection from "./_components/NotificationsSection";
import ConfidentialiteSection from "./_components/ConfidentialiteSection";
import TransfertSection from "./_components/TransfertSection";
import DangerSection from "./_components/DangerSection";
import ConfirmModal from "./_components/ConfirmModal";
import SaveToast from "./_components/SaveToast";
import InvitationLinkModal from "@/components/ui/InvitationLinkModal";
import SubscriptionManager from "@/components/subscription/SubscriptionManager";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   Recruiter Settings — /recruteur/parametres
   Left nav (click-to-switch) + content panel, 6 sections.
═══════════════════════════════════════════════════════════════ */

/* ── Password Change Modal ────────────────────────────────── */

function PasswordChangeModal({ onClose }: { onClose: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const isValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial && passwordsMatch;

  async function handleSubmit() {
    if (!isValid) return;
    setSaving(true);
    setError("");

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
    } else {
      setSuccess(true);
      setTimeout(onClose, 2000);
    }
  }

  const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 pr-12 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
  const labelCls = "block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5";

  function Rule({ met, label }: { met: boolean; label: string }) {
    return (
      <div className="flex items-center gap-1.5">
        {met ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /></svg>
        )}
        <span className={`text-[11px] ${met ? "text-[#22C55E]" : "text-[#6b7280]"}`}>{label}</span>
      </div>
    );
  }

  const eyeIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
  const eyeOffIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-head text-[18px] font-black text-white uppercase tracking-tight">Modifier le mot de passe</h3>
          <button type="button" aria-label="Fermer" onClick={onClose} className="w-8 h-8 rounded-full bg-[#111317] border border-[#2D3748] flex items-center justify-center text-[#6b7280] hover:text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" className="mx-auto mb-3"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            <p className="text-[15px] font-bold text-white">Mot de passe modifié avec succès</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Nouveau mot de passe</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Créer un mot de passe sécurisé" className={inputCls} />
                <button type="button" aria-label="Afficher le mot de passe" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-white transition-colors">
                  {showPassword ? eyeOffIcon : eyeIcon}
                </button>
              </div>

              {/* Password rules */}
              {newPassword.length > 0 && (
                <div className="grid grid-cols-2 gap-1 mt-2">
                  <Rule met={hasMinLength} label="8 caractères min." />
                  <Rule met={hasUppercase} label="Une majuscule" />
                  <Rule met={hasLowercase} label="Une minuscule" />
                  <Rule met={hasNumber} label="Un chiffre" />
                  <Rule met={hasSpecial} label="Un caractère spécial" />
                </div>
              )}
            </div>

            <div>
              <label className={labelCls}>Confirmer le mot de passe</label>
              <div className="relative">
                <input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Répéter le mot de passe" className={inputCls} />
                <button type="button" aria-label="Afficher la confirmation" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-white transition-colors">
                  {showConfirm ? eyeOffIcon : eyeIcon}
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-[11px] text-[#E63946] mt-1">Les mots de passe ne correspondent pas.</p>
              )}
              {passwordsMatch && (
                <p className="text-[11px] text-[#22C55E] mt-1 flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                  Les mots de passe correspondent.
                </p>
              )}
            </div>

            {error && (
              <div className="bg-[#E63946]/10 border border-[#E63946]/30 rounded-lg px-4 py-2.5">
                <p className="text-[12px] text-[#E63946]">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">Annuler</button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isValid || saving}
                className={`px-5 py-2.5 text-[13px] font-bold rounded-lg transition-colors ${isValid && !saving ? "bg-[#E63946] hover:bg-[#D42B22] text-white" : "bg-[#2D3748] text-[#4a4d56] cursor-not-allowed"}`}
              >
                {saving ? "Modification..." : "Modifier le mot de passe"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Admin CÉGEP section ──────────────────────────────────── */

function AdminCegepSection() {
  const [members, setMembers] = useState<{ id: string; name: string; initials: string; email: string; role: string; isAdmin: boolean; joinedAt: string; isCurrentUser: boolean }[]>([]);
  const [schoolName, setSchoolName] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const [sToast, setSToast] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [invitationLink, setInvitationLink] = useState<string>("");
  const [showInvitationModal, setShowInvitationModal] = useState(false);

  const showToast = (msg: string) => { setSToast(msg); setTimeout(() => setSToast(null), 3000); };

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: currentUser } = await supabase.from("users").select("school_id, is_school_admin").eq("id", user.id).single();
      if (!currentUser?.school_id) { setLoading(false); return; }
      setIsAdmin(!!(currentUser.is_school_admin));
      setSchoolId(currentUser.school_id);

      const { data: school } = await supabase.from("schools").select("name").eq("id", currentUser.school_id).single();
      setSchoolName(school?.name || "");

      const { data: team } = await supabase.from("users").select("id, first_name, last_name, email, role, is_school_admin, created_at").eq("school_id", currentUser.school_id).order("created_at", { ascending: true });

      if (team) {
        setMembers(team.map(m => ({
          id: m.id,
          name: `${m.first_name || ""} ${m.last_name || ""}`.trim() || "Sans nom",
          initials: `${(m.first_name || "")[0] || ""}${(m.last_name || "")[0] || ""}`.toUpperCase(),
          email: (m.email as string) || "",
          role: (m.role as string) || "RECRUTEUR",
          isAdmin: !!(m.is_school_admin),
          joinedAt: m.created_at,
          isCurrentUser: m.id === user.id,
        })));
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Generate URL-safe base64 token (~22 chars from 16 random bytes).
    const tokenBytes = crypto.getRandomValues(new Uint8Array(16));
    const token = btoa(String.fromCharCode(...tokenBytes))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const { data, error } = await supabase.from("invitations").insert({
      token,
      email: inviteEmail.trim(),
      invited_by: user.id,
      school_id: schoolId,
      message: inviteMsg.trim() || null,
      locale: "fr-CA",
    }).select("token").single();

    if (error) { showToast("Erreur: " + error.message); return; }

    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const invitationUrl = `${baseUrl}/auth/invitation?token=${data.token}`;
    setInvitationLink(invitationUrl);
    setShowInvitationModal(true);
    setInviteEmail("");
    setInviteMsg("");
  }

  async function handleRemove(memberId: string) {
    const supabase = createClient();
    await supabase.from("users").update({ school_id: null }).eq("id", memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
    setRemoveTarget(null);
    showToast("Membre retiré du CÉGEP");
  }

  const months = ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  function formatJoined(iso: string) { const d = new Date(iso); return `${months[d.getMonth()]} ${d.getFullYear()}`; }

  if (loading) return <p className="text-[#6b7280]">Chargement...</p>;

  if (!isAdmin) {
    return (
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-8 text-center">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
        <p className="text-[14px] text-[#9CA3AF]">Cette section est réservée aux directeurs sportifs.</p>
        <p className="text-[12px] text-[#6b7280] mt-1">Contactez votre directeur pour obtenir l&apos;accès.</p>
      </div>
    );
  }

  const directors = members.filter(m => m.isAdmin);
  const recruiters = members.filter(m => !m.isAdmin);
  const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
  const labelCls = "block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Gestion de mon CÉGEP</h2>
        <p className="text-[14px] text-[#6b7280] mt-1">{schoolName} — {members.length} membre{members.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Directors */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-4">Directeurs sportifs</p>
        <div className="space-y-3">
          {directors.map(m => (
            <div key={m.id} className="flex items-center gap-3 bg-[#13151a] rounded-lg p-3">
              <div className="w-10 h-10 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 flex items-center justify-center shrink-0">
                <span className="text-[12px] font-bold text-[#E63946]">{m.initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-white">{m.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#DAB65A]/15 text-[#DAB65A]">Directeur</span>
                  {m.isCurrentUser && <span className="text-[10px] text-[#6b7280]">(vous)</span>}
                </div>
                <p className="text-[12px] text-[#6b7280]">{m.email} · Membre depuis {formatJoined(m.joinedAt)}</p>
              </div>
            </div>
          ))}
          {directors.length === 0 && <p className="text-[12px] text-[#4a4d56] italic">Aucun directeur</p>}
        </div>
      </div>

      {/* Recruiters */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-4">Recruteurs</p>
        <div className="space-y-3">
          {recruiters.map(m => (
            <div key={m.id} className="flex items-center gap-3 bg-[#13151a] rounded-lg p-3">
              <div className="w-10 h-10 rounded-full bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center shrink-0">
                <span className="text-[12px] font-bold text-[#3B82F6]">{m.initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-white">{m.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#6B7280]/15 text-[#6B7280]">Recruteur</span>
                  {m.isCurrentUser && <span className="text-[10px] text-[#6b7280]">(vous)</span>}
                </div>
                <p className="text-[12px] text-[#6b7280]">{m.email} · Membre depuis {formatJoined(m.joinedAt)}</p>
              </div>
              {!m.isCurrentUser && (
                <button type="button" onClick={() => setRemoveTarget({ id: m.id, name: m.name })} className="text-[11px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors shrink-0">Retirer</button>
              )}
            </div>
          ))}
          {recruiters.length === 0 && <p className="text-[12px] text-[#4a4d56] italic">Aucun recruteur pour le moment.</p>}
        </div>
      </div>

      {/* Invite */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-4">Inviter un membre</p>
        <div className="max-w-md space-y-4">
          <div>
            <label className={labelCls}>Courriel</label>
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="nom@cegep.qc.ca" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Message <span className="font-normal text-[#4a4d56]">(optionnel)</span></label>
            <textarea value={inviteMsg} onChange={(e) => setInviteMsg(e.target.value)} rows={2} placeholder="Message personnalisé..." className={`${inputCls} resize-none`} />
          </div>
          <button type="button" onClick={handleInvite} disabled={!inviteEmail.trim()} className="px-5 py-2.5 rounded-lg bg-[#E63946] hover:bg-[#D42B22] disabled:bg-[#2D3748] disabled:text-[#4a4d56] text-white font-bold text-[12px] uppercase tracking-widest transition-colors">
            Envoyer l&apos;invitation
          </button>
          <p className="text-[11px] text-[#4a4d56]">Un lien d&apos;invitation sera généré. Partagez-le directement avec la personne. L&apos;invitation expire dans 30 jours.</p>
        </div>
      </div>

      {/* Remove confirmation */}
      {removeTarget && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRemoveTarget(null)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">Retirer {removeTarget.name}?</h3>
            <p className="text-[13px] text-[#9CA3AF] mt-2">Ses favoris et pipeline seront conservés mais dissociés du CÉGEP.</p>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button type="button" onClick={() => setRemoveTarget(null)} className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">Annuler</button>
              <button type="button" onClick={() => handleRemove(removeTarget.id)} className="px-5 py-2 bg-[#EF4444] hover:bg-[#DC2626] text-white text-[13px] font-bold rounded-lg transition-colors">Retirer</button>
            </div>
          </div>
        </div>
      )}

      {sToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#2D3748] text-white font-bold text-sm px-6 py-3 rounded-lg shadow-xl flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
          {sToast}
        </div>
      )}

      {showInvitationModal && (
        <InvitationLinkModal
          link={invitationLink}
          onClose={() => setShowInvitationModal(false)}
        />
      )}
    </div>
  );
}

/* ── Demo access toggle ───────────────────────────────────────
   DEV-only demo toggle that writes the canonical tier/admin state
   to Supabase (subscriptions + users tables). Replaces the prior
   localStorage-based toggle, which was bypassable and used the
   legacy role-prefixed taxonomy.
───────────────────────────────────────────────────────────────── */

function DemoRecruiterAccessToggle() {
  const { tier, isSchoolAdmin, subscription, refresh, loading } = useSubscription();
  const [busy, setBusy] = useState(false);

  if (process.env.NODE_ENV !== "development") return null;
  if (loading || !subscription) return null;

  const current: "free" | "pro" | "admin" =
    isSchoolAdmin ? "admin" : tier === "pro" || tier === "all_star" ? "pro" : "free";

  async function setAccess(mode: "free" | "pro" | "admin") {
    if (busy || !subscription) return;
    setBusy(true);
    const supabase = createClient();
    const userId = subscription.userId;

    if (mode === "admin") {
      await supabase.from("users").update({ is_school_admin: true }).eq("id", userId);
      await supabase.from("subscriptions").upsert(
        { user_id: userId, tier: "free", status: "active", billing_cycle: "monthly", updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    } else {
      await supabase.from("users").update({ is_school_admin: false }).eq("id", userId);
      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          tier: mode,
          status: "active",
          billing_cycle: mode === "free" ? null : "monthly",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    }
    await refresh();
    setBusy(false);
  }

  return (
    <div className="mt-8 pt-4 border-t border-[#2D3748]/20">
      <p className="text-[10px] text-[#4a4d56]/60 mb-2">DÉMO : Changer d&apos;accès (écrit dans la DB)</p>
      <div className="flex gap-2">
        {[
          { key: "free" as const,  label: "Recruteur Gratuit" },
          { key: "pro" as const,   label: "Recruteur Pro" },
          { key: "admin" as const, label: "Admin CÉGEP" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={busy}
            onClick={() => setAccess(t.key)}
            className={`px-3 py-1.5 rounded text-[10px] font-bold transition-colors ${
              current === t.key ? "bg-[#E63946]/15 text-[#E63946]" : "text-[#4a4d56] hover:text-[#6b7280]"
            } ${busy ? "opacity-50 cursor-wait" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RecruiterSettingsPage() {
  // Iter 7.39 — dispatch IS_CAPACITOR vers la version mobile.
  if (IS_CAPACITOR) return <RecruteurParametresMobile />;
  return <RecruiterSettingsDesktop />;
}

function RecruiterSettingsDesktop() {
  /* ── Form state ─────────────────────────────────────────────── */
  const emptySettings: RecruiterSettings = {
    accountId: "", firstName: "", lastName: "", email: "", phone: "", avatarUrl: "",
    locale: "fr", cegepId: "", roleTitle: "", sportIds: [], divisions: [], programIds: [],
    targetRegions: [], targetGradYears: [], targetPositions: [],
    minMoyenne: 75, minCoteGlobale: 3, alertNewProfiles: true,
    notifications: {
      newAthleteInSport: { inApp: true, email: false },
      favoriteUpdated: { inApp: true, email: false },
      coachResponse: { inApp: true, email: true },
      scoutingReport: { inApp: true, email: false },
      letterOfIntentSigned: { inApp: true, email: true },
      profileVerified: { inApp: true, email: false },
      weeklyDigest: false, emailFrequency: "realtime",
    },
    visibility: { profileVisible: true, showConsultationHistory: true, showFullName: true },
    accountStatus: "active",
  };
  const [form, setForm] = useState<RecruiterSettings>(emptySettings);
  const [original, setOriginal] = useState<RecruiterSettings>(emptySettings);

  /* ── UI state ───────────────────────────────────────────────── */
  const [section, setSection] = useState<SectionKey>("compte");
  const [toast, setToast] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [cegepModal, setCegepModal] = useState<string | null>(null);
  const [deactivateModal, setDeactivateModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [exportToast, setExportToast] = useState(false);

  const [schoolsList, setSchoolsList] = useState<{ id: string; name: string }[]>([]);
  const [signupDate, setSignupDate] = useState("");
  const [consentPrivacyDate, setConsentPrivacyDate] = useState("");
  const [consentDataDate, setConsentDataDate] = useState("");
  const [consentMarketingDate, setConsentMarketingDate] = useState<string | null>(null);
  const [consentPrivacyIso, setConsentPrivacyIso] = useState<string | null>(null);
  const [consentDataIso, setConsentDataIso] = useState<string | null>(null);
  const [consentMarketingIso, setConsentMarketingIso] = useState<string | null>(null);
  const [marketingConsent, setMarketingConsent] = useState(false);

  /* ── Load from Supabase ────────────────────────────────────── */
  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Load schools for Établissement dropdown
      const { data: schoolsData } = await supabase.from("schools").select("id, name").order("name");
      if (schoolsData) setSchoolsList(schoolsData);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("users")
        .select("first_name, last_name, phone, photo_url, school_id, title, sport, division, recruitment_preferences, notification_preferences, privacy_preferences")
        .eq("id", user.id)
        .single();

      // Set email and signup date from auth
      setForm(prev => ({ ...prev, email: user.email || "" }));
      setOriginal(prev => ({ ...prev, email: user.email || "" }));
      if (user.created_at) setSignupDate(new Date(user.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }));

      if (profile) {
        // Get school name for Etablissement
        let schoolName = "";
        if (profile.school_id) {
          const { data: school } = await supabase.from("schools").select("name, region").eq("id", profile.school_id).single();
          schoolName = school ? `${school.name} (${school.region})` : "";
        }

        // Map sport to sportIds array
        const sportIds = (profile.sport as string) ? [(profile.sport as string)] : [];
        // Map division to divisions array
        const divisions = (profile.division as string) ? [(profile.division as string).replace("Division ", "D") as "D1" | "D2" | "D3"] : [] as ("D1" | "D2" | "D3")[];

        // Load recruitment preferences
        const prefs = (profile.recruitment_preferences as Record<string, unknown>) || {};

        const updates: Partial<RecruiterSettings> = {
          firstName: (profile.first_name as string) || "",
          lastName: (profile.last_name as string) || "",
          email: user.email || "",
          phone: (profile.phone as string) || "",
          avatarUrl: (profile.photo_url as string) || "",
          cegepId: (profile.school_id as string) || "",
          roleTitle: (profile.title as string) || "",
          sportIds,
          divisions,
          targetRegions: (prefs.regions as string[]) || [],
          targetGradYears: (prefs.graduation_years as number[]) || [],
          targetPositions: (prefs.positions as string[]) || [],
          minMoyenne: (prefs.min_gpa as number) || 75,
          minCoteGlobale: (prefs.min_cote as number) || 3,
          alertNewProfiles: (prefs.alerts_enabled as boolean) ?? true,
        };

        // Load notification preferences
        const notifPrefs = (profile.notification_preferences as Record<string, unknown>) || {};
        if (Object.keys(notifPrefs).length > 0) {
          updates.notifications = {
            newAthleteInSport: { inApp: notifPrefs.app_new_athlete !== false, email: !!(notifPrefs.email_new_athlete) },
            favoriteUpdated: { inApp: notifPrefs.app_favorite_update !== false, email: !!(notifPrefs.email_favorite_update) },
            coachResponse: { inApp: notifPrefs.app_coach_reply !== false, email: notifPrefs.email_coach_reply !== false },
            scoutingReport: { inApp: notifPrefs.app_scouting_report !== false, email: !!(notifPrefs.email_scouting_report) },
            letterOfIntentSigned: { inApp: notifPrefs.app_lettre_intention !== false, email: notifPrefs.email_lettre_intention !== false },
            profileVerified: { inApp: notifPrefs.app_profile_verified !== false, email: !!(notifPrefs.email_profile_verified) },
            weeklyDigest: !!(notifPrefs.email_weekly_digest),
            emailFrequency: ((notifPrefs.email_frequency as string) || "realtime") as "realtime" | "daily" | "weekly" | "disabled",
          };
        }
        setMarketingConsent(!!(notifPrefs.marketing_emails));

        // Load privacy preferences
        const privPrefs = (profile.privacy_preferences as Record<string, unknown>) || {};
        if (Object.keys(privPrefs).length > 0) {
          updates.visibility = {
            profileVisible: privPrefs.profile_visible !== false,
            showConsultationHistory: privPrefs.show_consultations !== false,
            showFullName: privPrefs.show_full_name !== false,
          };
        }

        // Load per-consent dates
        const fmtDate = (iso: unknown) => iso ? new Date(iso as string).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }) : "";
        if (privPrefs.consent_privacy_policy) {
          setConsentPrivacyDate(fmtDate(privPrefs.consent_privacy_policy));
          setConsentPrivacyIso(privPrefs.consent_privacy_policy as string);
        }
        if (privPrefs.consent_data_collection) {
          setConsentDataDate(fmtDate(privPrefs.consent_data_collection));
          setConsentDataIso(privPrefs.consent_data_collection as string);
        }
        if (privPrefs.consent_marketing) {
          setConsentMarketingDate(fmtDate(privPrefs.consent_marketing));
          setConsentMarketingIso(privPrefs.consent_marketing as string);
        }

        setForm(prev => ({ ...prev, ...updates }));
        setOriginal(prev => ({ ...prev, ...updates }));
      }
    }
    load();
  }, []);

  /* ── Helpers ────────────────────────────────────────────────── */
  async function handleSave() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Map divisions back: ["D1"] → "Division 1"
    const divisionStr = form.divisions.length > 0 ? form.divisions[0].replace("D", "Division ") : null;
    // Map sportIds back: ["Football"] → "Football"
    const sportStr = form.sportIds.length > 0 ? form.sportIds[0] : null;

    const recruitmentPrefs = {
      regions: form.targetRegions || [],
      graduation_years: form.targetGradYears || [],
      positions: form.targetPositions || [],
      min_gpa: form.minMoyenne || null,
      min_cote: form.minCoteGlobale || null,
      alerts_enabled: form.alertNewProfiles ?? true,
    };

    const payload = {
      first_name: form.firstName || "",
      last_name: form.lastName || "",
      phone: form.phone || null,
      school_id: form.cegepId || null,
      title: form.roleTitle || null,
      sport: sportStr,
      division: divisionStr,
      recruitment_preferences: recruitmentPrefs,
      notification_preferences: {
        app_new_athlete: form.notifications.newAthleteInSport.inApp,
        app_favorite_update: form.notifications.favoriteUpdated.inApp,
        app_coach_reply: form.notifications.coachResponse.inApp,
        app_scouting_report: form.notifications.scoutingReport.inApp,
        app_lettre_intention: form.notifications.letterOfIntentSigned.inApp,
        app_profile_verified: form.notifications.profileVerified.inApp,
        email_new_athlete: form.notifications.newAthleteInSport.email,
        email_favorite_update: form.notifications.favoriteUpdated.email,
        email_coach_reply: form.notifications.coachResponse.email,
        email_scouting_report: form.notifications.scoutingReport.email,
        email_lettre_intention: form.notifications.letterOfIntentSigned.email,
        email_profile_verified: form.notifications.profileVerified.email,
        email_weekly_digest: form.notifications.weeklyDigest,
        email_frequency: form.notifications.emailFrequency,
        marketing_emails: marketingConsent,
      },
      privacy_preferences: {
        profile_visible: form.visibility.profileVisible,
        show_consultations: form.visibility.showConsultationHistory,
        show_full_name: form.visibility.showFullName,
        consent_privacy_policy: consentPrivacyIso || new Date().toISOString(),
        consent_data_collection: consentDataIso || new Date().toISOString(),
        consent_marketing: marketingConsent ? (consentMarketingIso || new Date().toISOString()) : null,
      },
    };

    const { data, error } = await supabase
      .from("users")
      .update(payload)
      .eq("id", user.id)
      .select();

    if (!error) {
      setOriginal(prev => ({ ...prev, firstName: form.firstName, lastName: form.lastName, phone: form.phone, roleTitle: form.roleTitle, sportIds: form.sportIds, divisions: form.divisions }));
      setToast(true);
    }
  }

  function updateField<K extends keyof RecruiterSettings>(key: K, value: RecruiterSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Paramètres
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          Gérez votre compte et vos préférences de recrutement
        </p>
      </div>

      {/* Layout: nav + content */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left nav */}
        <div className="lg:w-[240px] shrink-0">
          <RecruiterSettingsNav active={section} onChange={setSection} />
        </div>

        {/* Content panel */}
        <div className="flex-1 min-w-0">
          <div className="bg-[#111317]/60 backdrop-blur-sm rounded-xl border border-[#1e2128] p-6 sm:p-8">
            {section === "compte" && (
              <CompteSection
                form={form}
                original={original}
                onUpdate={updateField}
                onSave={handleSave}
                onPasswordModal={() => setPasswordModal(true)}
                onPhotoUpload={async (file: File) => {
                  const supabase = createClient();
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) return;
                  const fileExt = file.name.split(".").pop();
                  const filePath = `${user.id}/avatar.${fileExt}`;
                  const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
                  if (uploadError) { console.error("[Photo upload error]", uploadError); return; }
                  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
                  await supabase.from("users").update({ photo_url: urlData.publicUrl }).eq("id", user.id);
                  updateField("avatarUrl", urlData.publicUrl);
                }}
              />
            )}
            {section === "etablissement" && (
              <EtablissementSection
                form={form}
                original={original}
                onUpdate={updateField}
                onSave={handleSave}
                onCegepChange={(id) => setCegepModal(id)}
                schools={schoolsList}
              />
            )}
            {section === "recrutement" && (
              <RecrutementSection
                form={form}
                original={original}
                onUpdate={updateField}
                onSave={handleSave}
              />
            )}
            {section === "abonnement" && <SubscriptionManager role="RECRUTEUR" />}
            {section === "admin_cegep" && <AdminCegepSection />}
            {section === "notifications" && (
              <NotificationsSection
                form={form}
                original={original}
                onUpdateNotifications={(notifs) => setForm((prev) => ({ ...prev, notifications: notifs }))}
                onSave={handleSave}
              />
            )}
            {section === "confidentialite" && (
              <ConfidentialiteSection
                form={form}
                original={original}
                onUpdateVisibility={(vis) => setForm((prev) => ({ ...prev, visibility: vis }))}
                onSave={handleSave}
                onSectionChange={(s) => setSection(s as SectionKey)}
                signupDate={signupDate}
                consentPrivacyDate={consentPrivacyDate}
                consentDataDate={consentDataDate}
                consentMarketingDate={consentMarketingDate}
                marketingConsent={marketingConsent}
                onMarketingConsentChange={setMarketingConsent}
              />
            )}
            {section === "transfert" && (
              <TransfertSection
                currentSchoolId={form.cegepId}
                currentSchoolName={schoolsList.find((s) => s.id === form.cegepId)?.name || "Non défini"}
                schools={schoolsList}
              />
            )}
            {section === "danger" && (
              <DangerSection
                onDeactivate={() => setDeactivateModal(true)}
                onExport={() => setExportToast(true)}
                onDelete={() => setDeleteModal(true)}
              />
            )}
          </div>

          {/* Demo access toggle */}
          <DemoRecruiterAccessToggle />
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}
      {passwordModal && <PasswordChangeModal onClose={() => setPasswordModal(false)} />}

      <ConfirmModal
        open={!!cegepModal}
        onClose={() => setCegepModal(null)}
        onConfirm={() => { if (cegepModal) { updateField("cegepId", cegepModal); updateField("campusId", undefined); } setCegepModal(null); }}
        title="Changer de CÉGEP"
        message="Changer de CÉGEP réinitialisera certaines de vos préférences. Continuer ?"
        confirmLabel="Confirmer"
        cancelLabel="Annuler"
        variant="warning"
      />

      <ConfirmModal
        open={deactivateModal}
        onClose={() => setDeactivateModal(false)}
        onConfirm={() => {/* mock */}}
        title="Désactiver votre compte"
        message="Êtes-vous sûr de vouloir désactiver votre compte ? Vous pourrez le réactiver plus tard."
        confirmLabel="Désactiver"
        variant="warning"
      />

      <ConfirmModal
        open={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={() => {
          // Suppression DÉFINITIVE via la RPC delete_my_account (helper partagé :
          // signOut + redirection dedans). Le "deactivate" ci-dessus reste un
          // mock distinct (désactivation réversible — hors de ce chantier).
          void deleteMyAccount({
            onError: (m) => { window.alert("Échec de la suppression : " + m); },
          });
        }}
        title="Suppression définitive"
        message="Votre compte et vos données personnelles seront supprimés immédiatement et définitivement. Cette action est irréversible."
        confirmLabel="Supprimer mon compte"
        variant="danger"
        requireTyped="SUPPRIMER"
      />

      {/* ── Toasts ─────────────────────────────────────────────── */}
      <SaveToast show={toast} onHide={() => setToast(false)} />
      <SaveToast show={exportToast} onHide={() => setExportToast(false)} message="Export en cours..." />
    </div>
  );
}
