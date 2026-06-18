"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AthleteRecruiterProfileBodyMobile from "@/components/shared/AthleteRecruiterProfileBodyMobile";

/* ═══════════════════════════════════════════════════════════════
   Athlete self-preview — "Aperçu recruteur".

   Sprint C : mount the SHARED recruiter-perspective profile body
   from INSIDE the athlete portal so the athlete can preview how a
   recruiter sees their profile. The body's `viewer="self-preview"`
   value (added in this sprint) suppresses every recruiter-only
   side-effect : the action bar (Contacter / Add to List / Favorite),
   the pipeline block, the engagement KPIs, all 5 recruiter modals,
   AND the 3 recruiter-scoped useEffect fetches (recruiter_favorites,
   recruiter_pipeline, recruiter_athlete_views). The body's
   isRecruiter flag stays FALSE for this viewer — the existing
   `if (!isRecruiter) return;` early-returns in those 3 fetch
   useEffects auto-suppress without any change to the recruiter mount.

   RLS : the athlete reads their OWN athletes row + the joined
   reference rows via the "athletes can read own profile" policy
   (USING user_id = auth.uid()). NO recruiter privilege required.
   No recruiter-scoped table is queried at all.

   The PRIOR TRAP (avoided here) : routing the athlete into
   /recruteur/athletes/{id}. That trap (a) renders the recruiter
   action bar visible, (b) treats the athlete's free tier as a
   recruiter "free tier" → name/photo blur + "Passer à Pro" upsell,
   (c) fires recruiter_athlete_views.upsert with the athlete's user_id
   as recruiter_id → RLS-deny + silent `[recordView] failed: {}` in
   console. THIS page stays under /athlete/* and reuses the shared
   body — no cross-portal navigation.
═══════════════════════════════════════════════════════════════ */

export default function AthletePreviewPage() {
  const router = useRouter();
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "no-row" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) { setState("error"); return; }
      /* Resolve the athlete's OWN row id. The athlete layout's
         role-guard already enforces ATHLETE on this route, so an
         orphan/no-row case is the only failure path that warrants
         a friendly fallback — the rest is RLS-clean and silent. */
      const { data, error } = await supabase
        .from("athletes")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) { setState("error"); return; }
      if (!data) { setState("no-row"); return; }
      setAthleteId(data.id as string);
      setState("ready");
    })();
    return () => { cancelled = true; };
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#111317" }}>
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === "no-row" || state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: "#111317" }}>
        <div className="max-w-sm text-center space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#E63946]">Aperçu recruteur</p>
          <p className="text-[15px] text-white/75 leading-relaxed">
            {state === "no-row"
              ? "Ton profil athlète n'est pas encore créé. Termine l'onboarding pour activer l'aperçu recruteur."
              : "Impossible de charger ton aperçu pour le moment."}
          </p>
          <button
            type="button"
            onClick={() => router.push("/athlete/profil")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.10] text-[12px] font-bold uppercase tracking-wider text-white active:bg-white/[0.06]"
          >
            Retour au profil
          </button>
        </div>
      </div>
    );
  }

  /* viewerMode MUST stay "recruiter" — that's the dispatch switch the
     mobile body checks at line 493 ; any other value short-circuits
     to `return null;`. viewer="self-preview" is what actually drives
     the gating behavior.

     SCROLL WRAPPER (Sprint C, Fix 1) — replicate the recruiter route's
     proven scroll geometry. The recruiter layout sets
     `overflowX: "hidden"` on its <main> in Capacitor, which (per CSS
     spec) forces overflow-y from "visible" to "auto" → main becomes
     the scroll container → window stays dormant → the body's
     window-bound scroll listener at AthleteRecruiterProfileBodyMobile.tsx
     :1141 never fires → no per-frame setScrollY re-render → smooth
     native scroll. The athlete layout's <main> has no such overflow,
     so window scrolled by default + the body's listener fired every
     animation frame, re-rendering the entire ~2900-line body per
     frame on apercu → universal jank.

     The wrapper below applies the same overflow-x:hidden trick at the
     PAGE level, so :
       - this wrapper is the scroll container (window stays at scrollY 0)
       - the body's window scroll listener stays dormant (recruiter parity)
       - position:fixed + inset:0 makes this page IMMERSIVE — it covers
         the athlete MobileTabBar (z-40), which is correct UX for a
         "what does a recruiter see" preview. The body's back button at
         line 1532 routes self-preview → /athlete/profil, so hiding the
         tab bar does NOT trap the user.
       - zIndex 50 layers over the tab bar (z-40) + the layout chrome.
       - backgroundColor avoids a flicker against the layout's playbook
         background during the route transition.
     The body's own sticky top bar (at line 1520) sits inside this
     wrapper and uses `top: 0` — which sticks to this wrapper's top
     edge, the correct viewport edge given position:fixed. The status
     bar / notch is handled by the existing layout's safe-area
     boundaries (the athlete root layout has the viewport meta
     viewportFit:"cover" at app/layout.tsx:78). The body's top bar
     does NOT add its own safe-area padding — if the notch eats into
     it on certain devices, that's a body-level concern out of scope
     for this fix. */
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflowX: "hidden",
        backgroundColor: "#111317",
        zIndex: 50,
      }}
    >
      <AthleteRecruiterProfileBodyMobile
        athleteId={athleteId!}
        viewerMode="recruiter"
        viewer="self-preview"
      />
    </div>
  );
}
