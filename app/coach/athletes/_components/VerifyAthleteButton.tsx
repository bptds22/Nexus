"use client";

import { useState } from "react";
import ConfirmationModal from "../../../../components/shared/ConfirmationModal";

interface VerifyAthleteButtonProps {
  athleteName: string;
  isVerified: boolean;
  profilePercent: number;
  onVerify: () => void;
  onUnverify: () => void;
}

export default function VerifyAthleteButton({
  athleteName,
  isVerified,
  profilePercent,
  onVerify,
  onUnverify,
}: VerifyAthleteButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const isLowProfile = profilePercent < 60;

  if (isVerified) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-bold border border-[#2D3748] text-[#6B7280] hover:text-[#EF4444] hover:border-[#EF4444]/40 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18" /><path d="M6 6l12 12" />
          </svg>
          Retirer la vérification
        </button>
        <ConfirmationModal
          open={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={onUnverify}
          title="Retirer la vérification"
          description={`Êtes-vous sûr de vouloir retirer la vérification de ${athleteName}? Le profil ne sera plus visible par les recruteurs jusqu'à une nouvelle vérification.`}
          confirmLabel="Retirer"
          variant="danger"
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-bold bg-[#3B82F6] text-white hover:bg-[#1D4ED8] transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        Vérifier manuellement
      </button>
      <ConfirmationModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={onVerify}
        title="Vérifier cet athlète"
        description={
          isLowProfile
            ? `Le profil de ${athleteName} est à ${profilePercent}% (sous le seuil de 60%). En confirmant, vous certifiez que les informations sont exactes malgré le profil incomplet.`
            : `Confirmer la vérification manuelle du profil de ${athleteName}? Cela rendra le profil visible aux recruteurs.`
        }
        confirmLabel="Vérifier"
      />
    </>
  );
}
