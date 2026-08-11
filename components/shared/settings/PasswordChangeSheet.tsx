"use client";

/* ═══════════════════════════════════════════════════════════════
   PasswordChangeSheet — role-agnostic password change.

   5 rules + 2 inputs + supabase.auth.updateUser. The auth path is
   identical for every role, so this sheet ships as a shared block.

   Extracted verbatim from RecruteurParametresMobile.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { triggerHaptic } from "./utils";
import { useSheetKeyboardGeometry } from "@/lib/hooks/useSheetKeyboardGeometry";

export function PasswordChangeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const kbdStyle = useSheetKeyboardGeometry("90vh");
  const toast = useMobileToast();
  const [mounted, setMounted] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!open) { setNewPw(""); setConfirmPw(""); } }, [open]);

  const hasMin = newPw.length >= 8;
  const hasUpper = /[A-Z]/.test(newPw);
  const hasLower = /[a-z]/.test(newPw);
  const hasNum = /[0-9]/.test(newPw);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPw);
  const match = newPw === confirmPw && confirmPw.length > 0;
  const valid = hasMin && hasUpper && hasLower && hasNum && hasSpecial && match;

  async function handleSubmit() {
    if (!valid || saving) return;
    triggerHaptic("Medium");
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) { toast.error({ message: "Erreur", detail: error.message }); return; }
      toast.success({ message: "Mot de passe modifié" });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/60"
        style={{ animation: "nx-modal-fade 200ms ease-out forwards" }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[70] bg-[#1A1D24] rounded-t-2xl flex flex-col"
        style={{
          /* CLAVIER — sheet à trois champs mot de passe : sans plafond de
             hauteur il sortait par le haut quand la règle globale le remontait.
             90vh conservé comme hauteur clavier FERMÉ. */
          ...kbdStyle,
          animation: "nx-modal-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="px-5 pb-2 shrink-0">
          <h3 className="text-[17px] font-semibold text-white text-center mb-4">Changer le mot de passe</h3>
        </div>
        <div className="px-5 pb-4 flex-1 overflow-y-auto">
          <input
            type="password"
            autoComplete="new-password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="Nouveau mot de passe"
            className="w-full bg-[#13151a] border border-[#2a2d36] rounded-2xl px-4 py-3 text-[16px] text-white placeholder:text-[#4a4d56] focus:outline-none focus:border-[#E63946]/50"
          />
          {newPw.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 mt-3">
              <Rule met={hasMin} label="8 caractères min." />
              <Rule met={hasUpper} label="Une majuscule" />
              <Rule met={hasLower} label="Une minuscule" />
              <Rule met={hasNum} label="Un chiffre" />
              <Rule met={hasSpecial} label="Un caractère spécial" />
            </div>
          )}
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Confirmer le mot de passe"
            className="w-full mt-4 bg-[#13151a] border border-[#2a2d36] rounded-2xl px-4 py-3 text-[16px] text-white placeholder:text-[#4a4d56] focus:outline-none focus:border-[#E63946]/50"
          />
          {confirmPw.length > 0 && !match && (
            <p className="text-[12px] text-[#E63946] mt-2">Les mots de passe ne correspondent pas.</p>
          )}
        </div>
        <div className="px-5 pb-3 pt-2 shrink-0">
          <button
            type="button"
            onClick={() => { void triggerHaptic("Light"); handleSubmit(); }}
            disabled={!valid || saving}
            className={`w-full h-12 rounded-2xl text-[15px] font-semibold transition-colors ${
              valid && !saving ? "bg-[#E63946] text-white active:bg-[#D42B22]" : "bg-white/[0.06] text-[#6B7280] cursor-not-allowed"
            }`}
          >
            {saving ? "Modification…" : "Modifier le mot de passe"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 mt-2 text-[#9CA3AF] text-[15px]"
          >
            Annuler
          </button>
        </div>
      </div>
      <style jsx global>{`
        @keyframes nx-modal-fade { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes nx-modal-slideup { 0% { transform: translateY(100%); } 100% { transform: translateY(0); } }
      `}</style>
    </>,
    document.body,
  );
}

function Rule({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {met ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /></svg>
      )}
      <span className={`text-[11px] ${met ? "text-[#22C55E]" : "text-[#6b7280]"}`}>{label}</span>
    </div>
  );
}
