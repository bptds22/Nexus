"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reusable modal that displays a generated invitation link with a
 * copy-to-clipboard CTA. Matches the platform's dark theme and the
 * visual conventions of the flag modal in AthleteRecruiterProfileBody.
 *
 * Wired into recruteur/parametres (Phase 6.3 invitations); reusable
 * by any future call site that needs to surface a freshly created
 * invitation URL.
 */
export interface InvitationLinkModalProps {
  link: string;
  onClose: () => void;
  /** Optional explainer copy override. Default is the invitation context. */
  description?: string;
}

export default function InvitationLinkModal({ link, onClose, description }: InvitationLinkModalProps) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Fallback: select the input so the user can Ctrl+C manually.
      inputRef.current?.select();
    }
  }

  const explainer = description ?? "Partagez ce lien avec la personne que vous souhaitez inviter. L'invitation expire dans 30 jours.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl w-full max-w-[480px] mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#E63946]/15 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.72" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <div>
              <h3 className="font-head text-[16px] font-bold text-white uppercase tracking-wide">Invitation créée</h3>
              <p className="text-[12px] text-[#6b7280]">Lien prêt à partager</p>
            </div>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="text-[#6b7280] hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 pb-6 space-y-4">
          <p className="text-[14px] text-[#9CA3AF] leading-relaxed">{explainer}</p>
          <div>
            <label className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mb-1.5 block">Lien d&apos;invitation</label>
            <input
              ref={inputRef}
              type="text"
              value={link}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Lien d'invitation"
              className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[13px] text-[#e0e0e0] focus:border-[#E63946] outline-none font-mono"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg text-[14px] font-bold text-[#9CA3AF] hover:text-white transition-colors">
              Fermer
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className={`flex items-center gap-2 rounded-lg px-5 py-2.5 font-bold text-[14px] uppercase tracking-wider transition-all active:scale-95 ${
                copied ? "bg-[#F59E0B] text-[#111317]" : "bg-[#E63946] text-white hover:bg-[#D42B22]"
              }`}
            >
              {copied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Copié
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  Copier le lien
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
