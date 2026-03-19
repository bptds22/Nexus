/* ─────────────────────────────────────────────────────────────────
   Verification Utilities — auto-verify, manual verify, remove
   Threshold: profilePercent >= 60 → auto-eligible
───────────────────────────────────────────────────────────────── */

import type { AthleteVerification, VerificationMethod } from "../types/models";

const AUTO_VERIFY_THRESHOLD = 60;

/**
 * Check if an athlete is eligible for auto-verification.
 * Returns an updated AthleteVerification if the threshold is met
 * and the athlete isn't already verified.
 */
export function checkAutoVerify(
  profilePercent: number,
  current: AthleteVerification
): AthleteVerification {
  const autoEligible = profilePercent >= AUTO_VERIFY_THRESHOLD;

  // Already verified → just update eligibility flag
  if (current.isVerified) {
    return { ...current, autoEligible };
  }

  // Not yet verified + eligible → auto-verify
  if (autoEligible) {
    return {
      isVerified: true,
      method: "auto",
      verifiedAt: new Date().toISOString(),
      verifiedBy: "system",
      verifiedByName: "Système",
      profilePercentAtVerification: profilePercent,
      autoEligible: true,
      manualOverrideActive: false,
    };
  }

  // Not eligible → keep unverified, update flag
  return { ...current, autoEligible };
}

/**
 * Manually verify an athlete (coach or director action).
 */
export function verifyAthlete(
  profilePercent: number,
  verifiedBy: string,
  verifiedByName: string,
  method: Extract<VerificationMethod, "manual_coach" | "manual_director">
): AthleteVerification {
  return {
    isVerified: true,
    method,
    verifiedAt: new Date().toISOString(),
    verifiedBy,
    verifiedByName,
    profilePercentAtVerification: profilePercent,
    autoEligible: profilePercent >= AUTO_VERIFY_THRESHOLD,
    manualOverrideActive: profilePercent < AUTO_VERIFY_THRESHOLD,
  };
}

/**
 * Remove verification from an athlete (un-verify).
 */
export function removeVerification(
  profilePercent: number
): AthleteVerification {
  return {
    isVerified: false,
    method: null,
    verifiedAt: null,
    verifiedBy: null,
    verifiedByName: null,
    profilePercentAtVerification: null,
    autoEligible: profilePercent >= AUTO_VERIFY_THRESHOLD,
    manualOverrideActive: false,
  };
}

/**
 * Create a default (unverified) AthleteVerification for new athletes.
 */
export function createDefaultVerification(
  profilePercent: number
): AthleteVerification {
  const autoEligible = profilePercent >= AUTO_VERIFY_THRESHOLD;

  if (autoEligible) {
    return {
      isVerified: true,
      method: "auto",
      verifiedAt: new Date().toISOString(),
      verifiedBy: "system",
      verifiedByName: "Système",
      profilePercentAtVerification: profilePercent,
      autoEligible: true,
      manualOverrideActive: false,
    };
  }

  return {
    isVerified: false,
    method: null,
    verifiedAt: null,
    verifiedBy: null,
    verifiedByName: null,
    profilePercentAtVerification: null,
    autoEligible: false,
    manualOverrideActive: false,
  };
}
