/* ─────────────────────────────────────────────────────────────────
   LEGACY SHIM — DO NOT ADD NEW CODE HERE.
   The canonical badge system lives in lib/config/badges.ts (7 universal
   badges). This file only re-exports SPORT_NAME_MAP for non-badge code
   that maps sport display names → internal keys.
───────────────────────────────────────────────────────────────── */

export { SPORT_NAME_MAP, MAX_BADGES } from "./badges";
export type NexusSport = string;

export interface LeadershipBadge {
  badgeId: string;
  label: string;
  icon: string;
  detail?: string;
}

export interface BadgeOption {
  badgeId: string;
  label: string;
  icon: string;
  hasDetail: boolean;
  detailPlaceholder?: string;
}

/** @deprecated Use BADGE_CONFIG from lib/config/badges.ts — this returns an empty array. */
export function getBadgesForSport(_sportName: string): BadgeOption[] {
  return [];
}
