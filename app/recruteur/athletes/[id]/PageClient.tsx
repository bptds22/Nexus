"use client";

import { } from "react";
import { useSearchParams } from "next/navigation";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import AthleteRecruiterProfileBody, { type AthleteProfileViewerMode } from "@/components/shared/AthleteRecruiterProfileBody";
/* ═══════════════════════════════════════════════════════════════
   Recruiter Athlete Profile — thin wrapper.

   The body, state, queries, and JSX live in the shared component
   AthleteRecruiterProfileBody (used by recruiter, athlete-side
   preview iframe, and partner portal). This wrapper just parses
   URL params and selects the right viewerMode:

     ?preview=true      → athlete-side preview iframe
                          (recruiter-specific actions hidden)
     ?viewer=partner    → partner portal embed
                          (academic redacted, coach reputation
                          hidden, recordView write skipped)
     no params          → full recruiter view
═══════════════════════════════════════════════════════════════ */

export default function RecruiterAthletePage() {
  const id = useDynamicParam("id");
  const searchParams = useSearchParams();
  const viewer = searchParams?.get("viewer");
  const isPreview = searchParams?.get("preview") === "true";

  let viewerMode: AthleteProfileViewerMode = "recruiter";
  if (viewer === "partner") viewerMode = "partner";
  else if (isPreview) viewerMode = "preview";

  return <AthleteRecruiterProfileBody athleteId={id} viewerMode={viewerMode} />;
}
