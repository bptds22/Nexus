"use client";

import type { AthleteProfileRecruiterView } from "@/lib/types/models";
import { SPORT_NAME_MAP } from "@/lib/config/sportBadges";
import { isValidationExpired } from "@/lib/utils/profileValidation";

/* ═══════════════════════════════════════════════════════════════
   Athlete Player Card — shared hero card used by recruiter/coach/
   admin profile views, by the social-post export on the athlete
   settings page, AND by partner-side card downloads.

   Format prop scales the card to match social-post dimensions:
     compact     — 300×460 (default, profile views, in-app preview)
     publication — 1080×1350 (4:5, IG feed)
     story       — 1080×1920 (9:16, IG/TT story)

   Implementation: keep the natural 300-wide design and CSS-scale
   it inside a sized outer container. html-to-image captures the
   outer container's bounding box, so the resulting PNG always
   matches the target format dimensions exactly. This avoids
   parameterizing every hardcoded font size and padding.

   Pure, self-contained — renderable off-screen for capture
   without dragging in the rest of the profile view.
═══════════════════════════════════════════════════════════════ */

type CardFormat = "compact" | "publication" | "story" | "banniere";

const FORMAT_CONFIG: Record<CardFormat, {
  width: number;
  height: number;
  scale: number;
  topOffset: number;  // y-offset of the scaled card inside the outer box
  leftOffset: number; // x-offset (used to horizontally center publication)
}> = {
  // Compact mirrors the original 300-wide design verbatim.
  compact:     { width: 300,  height: 460,  scale: 1,    topOffset: 0,   leftOffset: 0  },
  // Publication: 1080×1350 (IG portrait, 4:5). The natural ticket-
  // style design is ~440px tall × 300px wide. At scale 3.6 it would
  // be 1584px tall — the ticket footer overflows the 1350 container
  // and gets clipped. Drop to scale 3.0 so the design fits height-
  // first (300×3.0=900 wide, ~440×3.0=1320 tall) and center
  // horizontally with 90px margins. ~15px top offset to give a
  // touch of breathing room above the badge.
  publication: { width: 1080, height: 1350, scale: 3.0,  topOffset: 15,  leftOffset: 90 },
  // Story: 1080×1920 (IG/TT story, 9:16). The natural design at
  // scale 3.6 = 1080 wide × 1584 tall, fits comfortably in 1920.
  // topOffset 285 pushes the card down so the ticket sits mid-
  // frame, leaving room above for partners to overlay text.
  story:       { width: 1080, height: 1920, scale: 3.6,  topOffset: 285, leftOffset: 0  },
  // Bannière: 1920×1080 (LinkedIn / Facebook / X cover, 16:9 wide).
  //
  // ⚠ DESIGN-PASS REQUIRED. The natural card is portrait (300 wide ×
  // ~440 tall = 0.68:1 width:height) ; a 16:9 banner is landscape
  // (1.78:1). Scaling the portrait card uniformly to fit the 1080 height
  // (scale = 1080/440 = ~2.45) renders the card 300×2.45 = ~735 wide,
  // centred in the 1920-wide frame with ~592px of dark dead-space on
  // each side (leftOffset = (1920 − 735) / 2 = ~592). Mechanically the
  // export works — toPng captures the outer wrapper's bounding box and
  // outputs a 1920×1080 PNG with the portrait card floating in the
  // middle — but the result is NOT design-finished. A proper banner
  // wants a wide-layout variant (e.g. photo on the left, stats stack
  // on the right, NEXUS wordmark, color blocks filling the side
  // panels). Registering the entry here lets the mobile carousel
  // include it ; the visual upgrade is a follow-up design pass.
  banniere:    { width: 1920, height: 1080, scale: 2.45, topOffset: 0,   leftOffset: 592 },
};

const SPORT_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(SPORT_NAME_MAP).map(([display, key]) => [key, display])
);

function positionAbbr(pos: string): string {
  const match = pos.match(/\(([^)]+)\)/);
  if (match) return match[1].toUpperCase();
  return pos.length > 4 ? pos.slice(0, 3).toUpperCase() : pos.toUpperCase();
}

export default function AthletePlayerCard({
  a,
  format = "compact",
  clipOverflow = false,
  animate = false,
}: {
  a: AthleteProfileRecruiterView;
  format?: CardFormat;
  /**
   * When true, the outer dims wrapper sets overflow: hidden — needed
   * by the html-to-image capture pipeline so the resulting PNG has
   * clean bounds. Defaults to false so in-page renders preserve the
   * card's intentional outside-edge content (ticket overhang, hover
   * tilt, NEXUS sidebar).
   */
  clipOverflow?: boolean;
  /**
   * Wow-A : when true, wrap the v30 card core in `.nx-wow-idle` (5.2s
   * idle bounce — keyframe translateY 0→-4px + scale 1→1.005) plus an
   * absolutely-positioned sheen sweep overlay (110deg gradient band
   * animated with `nx-wow-sheen` 4500ms ease-in-out infinite).
   *
   * Transforms compose because each lives on its OWN element :
   *   parent scale wrapper (e.g. carousel's scale 0.85)
   *     × .nx-wow-idle keyframe transform (translateY + scale 1.005)
   *     × inner scale wrapper (dims.scale for non-compact formats)
   *     × .nx-v30-card transform: rotate(-2deg)  (editorial tilt)
   *     × .nx-v30-ticket transform: rotate(3.5deg) (ticket tilt)
   *
   * Defaults to false so all 9 existing call sites are backward-
   * compatible. Export sites (the 4 sites with clipOverflow={true} +
   * .nx-capture-clean ancestor) MUST omit animate — a mid-sweep
   * frame would corrupt the html-to-image PNG. Belt-and-braces : the
   * sheen overlay div literally doesn't mount when animate=false, AND
   * the `.nx-capture-clean .nx-wow-idle { animation: none !important }`
   * rule in globals.css neutralizes any wow that slips through.
   */
  animate?: boolean;
}) {
  const dims = FORMAT_CONFIG[format];
  const ratingValue = a.overallRating;
  const posAbbr = positionAbbr(a.primaryPosition);
  const posDisplay = posAbbr || "—";
  const sportKey = SPORT_NAME_MAP[a.primarySport];
  const sportDisplay = sportKey ? (SPORT_DISPLAY[sportKey] || a.primarySport) : a.primarySport;
  const badgeActive = a.isVerified && !isValidationExpired({ verified: !!a.isVerified, last_profile_validation: a.lastValidation ?? null });

  return (
    <div
      style={{
        position: "relative",
        width: dims.width,
        height: dims.height,
        overflow: clipOverflow ? "hidden" : "visible",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: dims.topOffset,
          left: dims.leftOffset,
          transform: `scale(${dims.scale})`,
          transformOrigin: "top left",
        }}
      >
        {(() => {
          /* Wow-A : the v30 core is built once into a `core` const, then
             conditionally wrapped in `.nx-wow-idle` (the keyframe idle
             bounce) + a sibling sheen-sweep overlay when animate=true.
             When animate=false the const is rendered bare — no wow
             wrappers in the DOM at all, so export captures get a clean
             still frame. */
          const core = (
    <div className="nx-v30-wrap relative" style={{ width: 300, paddingTop: 6, paddingBottom: 10 }}>
      <div className="nx-v30-badge absolute z-30" style={{ top: 10, right: -12 }} title={badgeActive ? "Profil vérifié" : a.isVerified ? "Badge désactivé — confirmation requise" : "Profil non vérifié"}>
        <div className="rounded-full" style={{ border: "3px solid #111317" }}>
          {badgeActive ? (
            <svg width="48" height="48" viewBox="0 0 54 54" fill="none">
              <defs>
                <radialGradient id="apv_rc_bg" cx="38%" cy="28%" r="68%">
                  <stop offset="0%" stopColor="#29AAFF" />
                  <stop offset="55%" stopColor="#0094F0" />
                  <stop offset="100%" stopColor="#0060C0" />
                </radialGradient>
              </defs>
              <circle cx="27" cy="27" r="26" fill="#0060C0" opacity="0.35" />
              <circle cx="27" cy="27" r="24" fill="url(#apv_rc_bg)" />
              <circle cx="27" cy="27" r="24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <path d="M16,27 L22,34 L38,18" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          ) : (
            <svg width="48" height="48" viewBox="0 0 54 54" fill="none">
              <circle cx="27" cy="27" r="26" fill="#4B5563" opacity="0.35" />
              <circle cx="27" cy="27" r="24" fill="#6B7280" />
              <circle cx="27" cy="27" r="24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
              <path d="M16,27 L22,34 L38,18" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          )}
        </div>
      </div>

      <div className="nx-v30-card relative overflow-visible" style={{ width: 300, borderRadius: 10 }}>
        <div className="relative overflow-hidden" style={{ width: 300, height: 420, borderRadius: 10, background: "#2F3440" }}>
          {a.photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={a.photoUrl} alt={`${a.firstName} ${a.lastName}`} className="absolute inset-0 w-full h-full object-cover z-[1]" crossOrigin="anonymous" />
          ) : (
            <div className="absolute inset-0 z-[1] flex items-center justify-center">
              <span style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: 120, fontWeight: 900, color: "rgba(255,255,255,0.06)", letterSpacing: "0.05em", lineHeight: 1 }}>
                {a.firstName[0]}{a.lastName[0]}
              </span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]" style={{ background: "linear-gradient(to top, rgba(11,18,32,0.97) 0%, rgba(11,18,32,0.7) 35%, transparent 100%)" }} />
          <div className="absolute bottom-4 left-4 z-[3]">
            <p style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "0.04em", lineHeight: 1, textTransform: "uppercase" }}>{a.firstName}</p>
            <p style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "0.04em", lineHeight: 1, textTransform: "uppercase" }}>{a.lastName}</p>
          </div>
        </div>

        <div className="nx-v30-ticket absolute z-[999] overflow-hidden" style={{ bottom: -14, right: -22, borderRadius: 4, border: "1.5px solid rgba(255,255,255,0.08)" }}>
          <div className="flex" style={{ width: 322 }}>
            <div className="flex flex-col justify-between" style={{ background: "#1E2128", padding: "12px 14px 12px 16px", minWidth: 96, gap: 4 }}>
              {[
                { lbl: "Sport", val: sportDisplay },
                { lbl: "Pos", val: posDisplay },
                { lbl: "No.", val: a.jerseyNumber ? `#${a.jerseyNumber}` : "—" },
              ].map((r) => (
                <div key={r.lbl}>
                  <div style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: 7, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.38)", marginBottom: 1 }}>{r.lbl}</div>
                  {/* Sprint WOW-finitions §C — fontSize 16 → 15 pour que les
                      noms de sports longs ("Basketball", "Volleyball") tiennent
                      dans la colonne ticket. Impact app-wide (composant partagé)
                      bénéfique — pas de troncature, sports courts toujours nets. */}
                  <div style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: 15, fontWeight: 900, color: "#fff", letterSpacing: "0.06em", lineHeight: 1 }}>{r.val}</div>
                </div>
              ))}
            </div>
            <div className="nx-v30-perf flex flex-col items-center justify-center" style={{ width: 12, background: "#E6E6E6", borderLeft: "1.5px dashed rgba(11,18,32,0.2)", borderRight: "1.5px dashed rgba(11,18,32,0.2)", gap: 3 }}>
              {[...Array(8)].map((_, i) => (
                <span key={i} className="flex-shrink-0" style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(11,18,32,0.2)" }} />
              ))}
            </div>
            <div className="flex-1 flex flex-col justify-center" style={{ background: "#FFFFFF", padding: "12px 16px" }}>
              <div className="relative overflow-hidden" style={{ display: "inline-flex", alignItems: "center", gap: 3, marginBottom: 6 }}>
                {Array.from({ length: 5 }, (_, i) => (
                  <svg key={i} width="28" height="28" viewBox="0 0 24 24" fill={ratingValue >= i + 1 ? "#F59E0B" : ratingValue >= i + 0.5 ? "#F59E0B" : "#D1D5DB"} stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ))}
              </div>
              <div style={{ fontFamily: "var(--font-outfit), sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "#1E2128", marginBottom: 2, lineHeight: 1.2 }}>{a.isCivil ? (a.teamName || a.leagueName || "") : a.schoolName}</div>
              <div style={{ fontFamily: "var(--font-outfit), sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9CA3AF", lineHeight: 1.2 }}>{a.region}</div>
              <div style={{ fontFamily: "var(--font-outfit), sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#E63946", marginTop: 4 }}>Promotion {a.graduationYear}</div>
            </div>
            <div className="flex items-center justify-center flex-shrink-0" style={{ background: "#E63946", width: 24, writingMode: "vertical-rl", fontFamily: "var(--font-outfit), sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", color: "rgba(255,255,255,0.7)" }}>NEXUS</div>
          </div>
        </div>
      </div>
      </div>
          );
          /* Wow-A : when animate, wrap core in `.nx-wow-idle` (carries the
             bounce — keyframe translateY 0→-4px + scale 1→1.005, on its
             OWN element so it doesn't collide with v30-card's -2deg
             rotation or with the parent's scale) + a sibling sheen
             overlay (mirrors AthleteOnboardingWowMobile :428-435 pattern :
             nx-wow-sheen keyframe is NOT a class, applied inline ; the
             outer wrap clips the sweeping gradient via overflow:hidden ;
             pointerEvents:none so the sheen never eats taps). When animate
             is false, the wow markup never mounts → export-safe. */
          if (!animate) return core;
          return (
            <div className="nx-wow-idle" style={{ position: "relative", width: 300 }}>
              {core}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  pointerEvents: "none",
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -20,
                    bottom: -20,
                    width: 80,
                    background:
                      "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.32) 50%, transparent 70%)",
                    animation: "nx-wow-sheen 4500ms ease-in-out infinite",
                  }}
                />
              </div>
            </div>
          );
        })()}
    </div>
    </div>
  );
}
