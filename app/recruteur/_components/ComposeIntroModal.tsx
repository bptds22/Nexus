"use client";

import { useState } from "react";

/* ─────────────────────────────────────────────────────────────────
   ComposeIntroModal
   Pre-fills an introduction message from recruiter + athlete data.
   Recruiter can edit before sending. Cancel = status stays unchanged.
───────────────────────────────────────────────────────────────── */

interface Props {
  recruiter: {
    firstName: string;
    lastName: string;
    title: string;
    cegep: string;
    teamName: string;
    division: string;
  };
  athlete: {
    firstName: string;
    lastName: string;
    position: string;
    school: string;
    graduationYear: number;
  };
  coachName: string;
  onSend: (message: string) => void;
  onCancel: () => void;
}

function generateIntroMessage(p: Props): string {
  const r = p.recruiter;
  const a = p.athlete;
  return `Bonjour Coach ${p.coachName},

Je suis ${r.firstName} ${r.lastName}, ${r.title} au ${r.cegep} (${r.teamName}), ${r.division}.

Le profil de ${a.firstName} ${a.lastName} (${a.position}, ${a.school}, Promotion ${a.graduationYear}) a retenu mon attention sur Nexus.

J'aimerais en savoir plus sur cet athlète et discuter d'une possible opportunité au sein de notre programme.

Au plaisir d'échanger avec vous.

${r.firstName} ${r.lastName}
${r.title}, ${r.cegep}`;
}

export default function ComposeIntroModal(props: Props) {
  const [message, setMessage] = useState(() => generateIntroMessage(props));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={props.onCancel} />

      {/* Modal */}
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl w-full max-w-[560px] mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </div>
            <div>
              <h3 className="font-head text-[16px] font-bold text-white uppercase tracking-wide">Contacter le coach</h3>
              <p className="text-[12px] text-[#6b7280]">
                À propos de {props.athlete.firstName} {props.athlete.lastName} ({props.athlete.position})
              </p>
            </div>
          </div>
          <button type="button" aria-label="Fermer" onClick={props.onCancel} className="text-[#6b7280] hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <p className="text-[12px] text-[#9CA3AF] leading-relaxed">
            Ce message sera envoyé au coach. Tu peux le modifier avant d&apos;envoyer.
            Le statut passera à <span className="font-bold text-white">Contacté</span> une fois envoyé.
          </p>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-white/30 outline-none resize-none transition-colors"
            rows={12}
          />

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={props.onCancel}
              className="px-4 py-2.5 rounded-lg text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={!message.trim()}
              onClick={() => props.onSend(message)}
              className="flex items-center gap-2 bg-white text-[#111317] rounded-lg px-5 py-2.5 font-bold text-[13px] uppercase tracking-wider transition-all hover:bg-[#e0e0e0] active:scale-95 disabled:opacity-40"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Envoyer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
