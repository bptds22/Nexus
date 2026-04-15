"use client";

import type { AthleteProfileRecruiterView } from "@/lib/types/models";
import { SPORT_NAME_MAP } from "@/lib/config/sportBadges";
import { isValidationExpired } from "@/lib/utils/profileValidation";

/* ═══════════════════════════════════════════════════════════════
   Athlete Player Card — shared hero card used by recruiter/coach/
   admin profile views AND by the social-post export on the
   athlete settings page.

   Keeping this as a pure, self-contained component so it can be
   rendered off-screen into a canvas (html-to-image) without
   dragging in the rest of the profile view.
═══════════════════════════════════════════════════════════════ */

const SPORT_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(SPORT_NAME_MAP).map(([display, key]) => [key, display])
);

function positionAbbr(pos: string): string {
  const match = pos.match(/\(([^)]+)\)/);
  if (match) return match[1].toUpperCase();
  return pos.length > 4 ? pos.slice(0, 3).toUpperCase() : pos.toUpperCase();
}

export default function AthletePlayerCard({ a }: { a: AthleteProfileRecruiterView }) {
  const ratingValue = a.overallRating;
  const posAbbr = positionAbbr(a.primaryPosition);
  const secPosAbbr = a.secondaryPosition ? positionAbbr(a.secondaryPosition) : "";
  const posDisplay = secPosAbbr ? `${posAbbr} / ${secPosAbbr}` : (posAbbr || "—");
  const sportKey = SPORT_NAME_MAP[a.primarySport];
  const sportDisplay = sportKey ? (SPORT_DISPLAY[sportKey] || a.primarySport) : a.primarySport;
  const badgeActive = a.isVerified && !isValidationExpired({ verified: !!a.isVerified, last_profile_validation: a.lastValidation ?? null });

  return (
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
                  <div style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: "0.06em", lineHeight: 1 }}>{r.val}</div>
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
              <div style={{ fontFamily: "var(--font-outfit), sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "#1E2128", marginBottom: 2, lineHeight: 1.2 }}>{a.schoolName}</div>
              <div style={{ fontFamily: "var(--font-outfit), sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9CA3AF", lineHeight: 1.2 }}>{a.region}</div>
              <div style={{ fontFamily: "var(--font-outfit), sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#E63946", marginTop: 4 }}>Promotion {a.graduationYear}</div>
            </div>
            <div className="flex items-center justify-center flex-shrink-0" style={{ background: "#E63946", width: 24, writingMode: "vertical-rl", fontFamily: "var(--font-outfit), sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", color: "rgba(255,255,255,0.7)" }}>NEXUS</div>
          </div>
        </div>
      </div>
    </div>
  );
}
