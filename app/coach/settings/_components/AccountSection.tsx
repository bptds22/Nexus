"use client";

import { useState } from "react";
import type { AccountInfo } from "../_data/mockSettingsData";

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

interface Props {
  data: AccountInfo;
}

export default function AccountSection({ data }: Props) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [twoFactor, setTwoFactor] = useState(data.twoFactorEnabled ?? false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
            <p className="text-[14px] text-[#e0e0e0]">{data.email}</p>
          </div>
          <div>
            <p className={label}>Membre depuis</p>
            <p className="text-[14px] text-[#e0e0e0]">{formatDate(data.createdAt)}</p>
          </div>
          <div>
            <p className={label}>Dernière connexion</p>
            <p className="text-[14px] text-[#e0e0e0]">{formatDateTime(data.lastLogin)}</p>
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF]">Mot de passe</h3>
          <button
            type="button"
            onClick={() => setShowPasswordForm(!showPasswordForm)}
            className="text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors"
          >
            {showPasswordForm ? "Annuler" : "Modifier"}
          </button>
        </div>

        {showPasswordForm && (
          <div className="space-y-4 pt-2">
            <div>
              <p className={label}>Mot de passe actuel</p>
              <input type="password" placeholder="••••••••" className={input} />
            </div>
            <div>
              <p className={label}>Nouveau mot de passe</p>
              <input type="password" placeholder="Minimum 8 caractères" className={input} />
            </div>
            <div>
              <p className={label}>Confirmer le nouveau mot de passe</p>
              <input type="password" placeholder="Confirmer" className={input} />
            </div>
            <button
              type="button"
              className="bg-[#E63946] hover:bg-[#D42B22] text-white text-[14px] font-bold px-6 py-2.5 rounded-lg transition-colors"
            >
              Mettre à jour
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
            <p className="text-[14px] text-[#e0e0e0]">
              Es-tu sûr de vouloir supprimer ton compte? Cette action ne peut pas être annulée.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold px-5 py-2 rounded-lg transition-colors"
              >
                Oui, supprimer
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
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
