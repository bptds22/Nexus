"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteMyAccount } from "@/lib/auth/deleteAccount";

/* ─────────────────────────────────────────────────────────────────
   AccountSection — Account info, password, 2FA, danger zone
───────────────────────────────────────────────────────────────── */

const label = "text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-1.5";
const input = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${formatDate(iso)} à ${d.getHours().toString().padStart(2, "0")}h${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function AccountSection() {
  const [email, setEmail] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [lastLogin, setLastLogin] = useState("");
  const [loading, setLoading] = useState(true);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [twoFactor, setTwoFactor] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      setEmail(user.email || "");
      setCreatedAt(user.created_at || "");
      setLastLogin(user.last_sign_in_at || "");
      setLoading(false);
    }
    loadData();
  }, []);

  async function handlePasswordChange() {
    if (newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "Le mot de passe doit contenir au moins 8 caractères." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Les mots de passe ne correspondent pas." });
      return;
    }
    setPasswordSaving(true);
    setPasswordMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPasswordSaving(false);
      setPasswordMsg({ type: "error", text: "Erreur lors de la mise à jour du mot de passe." });
      return;
    }
    setPasswordSaving(false);
    setPasswordMsg({ type: "success", text: "Mot de passe mis à jour." });
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => { setPasswordMsg(null); setShowPasswordForm(false); }, 2500);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    // Suppression DÉFINITIVE via la RPC delete_my_account (helper partagé :
    // signOut + redirection dedans). Remplace l'ancien INSERT direct dans
    // deletion_requests (status 'pending' minuscule → violait le CHECK, et
    // ne supprimait rien réellement).
    await deleteMyAccount({
      redirectTo: "/",
      onError: (m) => { setDeleting(false); setDeleteError("Erreur lors de la suppression : " + m); },
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Compte & sécurité</h2>
        <p className="text-[14px] text-[#6b7280] mt-1">Gère ton compte, ton mot de passe et la sécurité.</p>
      </div>

      {/* Account info */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5 space-y-4">
        <h3 className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF]">Informations du compte</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className={label}>Courriel</p>
            <p className="text-[14px] text-[#e0e0e0]">{email}</p>
          </div>
          <div>
            <p className={label}>Membre depuis</p>
            <p className="text-[14px] text-[#e0e0e0]">{createdAt ? formatDate(createdAt) : "—"}</p>
          </div>
          <div>
            <p className={label}>Dernière connexion</p>
            <p className="text-[14px] text-[#e0e0e0]">{lastLogin ? formatDateTime(lastLogin) : "—"}</p>
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF]">Mot de passe</h3>
          <button
            type="button"
            onClick={() => { setShowPasswordForm(!showPasswordForm); setPasswordMsg(null); }}
            className="text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors"
          >
            {showPasswordForm ? "Annuler" : "Modifier"}
          </button>
        </div>

        {showPasswordForm && (
          <div className="space-y-4 pt-2">
            <div>
              <p className={label}>Nouveau mot de passe</p>
              <input
                type="password"
                title="Nouveau mot de passe"
                placeholder="Minimum 8 caractères"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={input}
              />
            </div>
            <div>
              <p className={label}>Confirmer le nouveau mot de passe</p>
              <input
                type="password"
                title="Confirmer le nouveau mot de passe"
                placeholder="Confirmer"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={input}
              />
            </div>
            {passwordMsg && (
              <p className={`text-[13px] font-semibold ${passwordMsg.type === "success" ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                {passwordMsg.text}
              </p>
            )}
            <button
              type="button"
              onClick={handlePasswordChange}
              disabled={passwordSaving}
              className="bg-[#E63946] hover:bg-[#D42B22] text-white text-[14px] font-bold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {passwordSaving ? "Mise à jour..." : "Mettre à jour"}
            </button>
          </div>
        )}
      </div>

      {/* Two-factor authentication */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF]">
              Authentification à deux facteurs
            </h3>
            <p className="text-[12px] text-[#6b7280] mt-1">
              {twoFactor
                ? "L'authentification à deux facteurs est activée."
                : "Ajoute une couche de sécurité supplémentaire à ton compte."}
            </p>
          </div>
          <button
            type="button"
            title="Activer ou désactiver l'authentification à deux facteurs"
            onClick={() => setTwoFactor(!twoFactor)}
            className={`relative w-12 h-[26px] rounded-full transition-colors ${
              twoFactor ? "bg-[#22C55E]" : "bg-[#2D3748]"
            }`}
          >
            <span
              className={`absolute top-[3px] w-5 h-5 rounded-full bg-white transition-transform ${
                twoFactor ? "left-[26px]" : "left-[3px]"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-[#1A1D24] rounded-xl border border-red-900/40 p-5 space-y-4">
        <h3 className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#E63946]">Zone dangereuse</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[14px] font-semibold text-[#e0e0e0]">Supprimer mon compte</p>
            <p className="text-[12px] text-[#6b7280] mt-0.5">
              Cette action est irréversible. Toutes tes données seront supprimées.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
            className="text-[12px] font-bold text-[#E63946] border border-[#E63946]/30 hover:bg-[#E63946]/10 px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            Supprimer
          </button>
        </div>

        {showDeleteConfirm && (
          <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4 space-y-3">
            <p className="text-[14px] font-bold text-white">Supprimer mon compte ?</p>
            <p className="text-[14px] text-[#e0e0e0]">
              Ton compte et tes données personnelles seront supprimés immédiatement et définitivement. Cette action est irréversible.
            </p>
            {deleteError && (
              <p className="text-[13px] font-semibold text-[#EF4444]">{deleteError}</p>
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? "Suppression..." : "Supprimer définitivement"}
              </button>
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                className="text-[12px] font-bold text-[#9CA3AF] hover:text-white transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
