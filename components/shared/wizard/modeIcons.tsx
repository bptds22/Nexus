/* ═══════════════════════════════════════════════════════════════
   Mode-indicator icons + color tokens.

   Extracted VERBATIM from app/athlete/profil/page.tsx :21-43 so the
   mobile athlete editor can consume the same glyphs/colors as the
   web profile. The web page's local copies are intentionally left
   in place for this sprint (so the existing web tree doesn't churn) ;
   a follow-up cleanup can swap them to imports from here without
   any visual change.

   Mode → color :
     DIRECT  → GREEN  (athlete edits, writes immediately to athletes)
     SUGGEST → YELLOW (athlete proposes via athlete_suggestions ;
                       coach approves via apply_approved_suggestion)
     LOCKED  → RED    (coach-only, display-only for the athlete)
═══════════════════════════════════════════════════════════════ */

export const GREEN = "#22C55E";
export const YELLOW = "#EAB308";
export const RED = "#E63946";

export function PencilIcon({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}
