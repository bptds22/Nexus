"use client";

import InviteForm from "@/components/director/InviteForm";
import InvitationsList from "@/components/director/InvitationsList";
import { mockInvitations, RSEQ_SPORTS } from "@/lib/mock";

export default function InviterCoachPage() {
  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="font-head text-[22px] font-black text-white uppercase tracking-tight">
          Inviter un coach
        </h1>
        <p className="text-[13px] text-[#6B7280] mt-1">
          Envoyez une invitation à un entra&icirc;neur pour rejoindre votre
          &eacute;cole sur Nexus
        </p>
      </div>
      <InviteForm portalType="ecole" sports={RSEQ_SPORTS} />
      <InvitationsList invitations={mockInvitations} />
    </div>
  );
}
