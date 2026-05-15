"use client";

import { useAdminClaim } from "@/lib/hooks/useAdminClaim";

/* ─────────────────────────────────────────────────────────────────
   ReadOnlyIfPending — Item 11-Security

   Wraps a section of UI in a disabled <fieldset> when the current
   user has a PENDING admin_claims row. Browsers naturally cascade
   `disabled` to nested form controls (inputs, selects, textareas,
   buttons), so this is enough to neuter most mutation surfaces
   without touching every individual page.

   This is a UX-level guard — RLS-level enforcement is a P2.5 follow-
   up. For pre-beta volumes (admin reviews ≤ 24h) the banner +
   fieldset combination is sufficient and keeps the diff small.

   Usage:
     <ReadOnlyIfPending>
       <AthleteCreateForm />
     </ReadOnlyIfPending>

   The wrapper renders nothing visual when the user is APPROVED /
   REJECTED / has no claim — exit path is `<>{children}</>`, no
   layout shift.
───────────────────────────────────────────────────────────────── */

export default function ReadOnlyIfPending({ children }: { children: React.ReactNode }) {
  const { claim } = useAdminClaim();
  const isReadOnly = claim?.status === "PENDING";

  if (!isReadOnly) return <>{children}</>;

  return (
    <fieldset
      disabled
      aria-disabled
      className="border-0 p-0 m-0 min-w-0 opacity-60 pointer-events-auto"
      style={{ filter: "grayscale(0.2)" }}
    >
      {children}
    </fieldset>
  );
}
