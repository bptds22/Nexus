"use client";

import InviteForm from "@/components/director/InviteForm";
import InvitationsList from "@/components/director/InvitationsList";
import CegepGate from "@/components/subscription/CegepGate";
import { mockInvitations, RSEQ_SPORTS } from "@/lib/mock";

export default function InviterRecruteurWrapper() {
  return <CegepGate><InviterRecruteurPage /></CegepGate>;
}

function InviterRecruteurPage() {
  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="font-head text-[22px] font-black text-white uppercase tracking-tight">
          Inviter un entra&icirc;neur
        </h1>
        <p className="text-[13px] text-[#6B7280] mt-1">
          Envoyez une invitation &agrave; un entra&icirc;neur-recruteur pour
          rejoindre votre C&Eacute;GEP sur Nexus
        </p>
      </div>
      <div className="bg-[#1A1D24] rounded-lg border border-white/5 px-4 py-3 flex items-start gap-2.5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
        <p className="text-[12px] text-[#6B7280] leading-relaxed">Les directeurs invités seront ajoutés comme collaborateurs. Le directeur principal peut être changé via les paramètres ou en contactant l&apos;administration.</p>
      </div>
      <InviteForm portalType="cegep" sports={RSEQ_SPORTS} />
      <InvitationsList invitations={mockInvitations} />
    </div>
  );
}
