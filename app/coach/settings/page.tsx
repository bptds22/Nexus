"use client";

import { useState } from "react";
import SettingsNav from "./_components/SettingsNav";
import ProfileSection from "./_components/ProfileSection";
import SchoolSection from "./_components/SchoolSection";
import NotificationsSection from "./_components/NotificationsSection";
import AccountSection from "./_components/AccountSection";
import type { SettingsSection } from "./_components/SettingsNav";
import SubscriptionSection from "@/components/subscription/SubscriptionSection";
import AmbassadorDashboard from "@/components/ambassador/AmbassadorDashboard";
import {
  MOCK_COACH_PROFILE,
  MOCK_SCHOOL_INFO,
  MOCK_NOTIFICATIONS,
  MOCK_ACCOUNT,
} from "./_data/mockSettingsData";

/* ═══════════════════════════════════════════════════════════════
   Coach Settings — Paramètres
   Left nav + content panel, 4 sections.
═══════════════════════════════════════════════════════════════ */

export default function CoachSettingsPage() {
  const [section, setSection] = useState<SettingsSection>("profil");

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Paramètres
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          Gère ton profil, ton école et tes préférences.
        </p>
      </div>

      {/* Layout: nav + content */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left nav */}
        <div className="lg:w-[240px] shrink-0">
          <SettingsNav active={section} onChange={setSection} />
        </div>

        {/* Content panel */}
        <div className="flex-1 min-w-0">
          <div className="bg-[#111317]/60 backdrop-blur-sm rounded-xl border border-[#1e2128] p-6 sm:p-8">
            {section === "profil" && <ProfileSection data={MOCK_COACH_PROFILE} />}
            {section === "ecole" && <SchoolSection data={MOCK_SCHOOL_INFO} />}
            {section === "abonnement" && <SubscriptionSection portal="coach" />}
            {section === "ambassadeur" && <AmbassadorDashboard isAmbassador={true} />}
            {section === "notifications" && <NotificationsSection data={MOCK_NOTIFICATIONS} />}
            {section === "compte" && <AccountSection data={MOCK_ACCOUNT} />}
          </div>
        </div>
      </div>
    </div>
  );
}
