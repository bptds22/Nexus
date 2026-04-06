import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  Sequence,
  Video,
  staticFile,
  spring,
} from "remotion";
import { colors, fonts } from "./styles";

/**
 * NEXUS PROMO — Nike "Why Do It" style
 *
 * Rules:
 *  - NO text during footage. Zero overlays. Let the clips breathe.
 *  - Hard cuts only. No cross-fades, no transitions.
 *  - Fast cuts: 1-2 seconds each. Relentless.
 *  - Natural color grading — warm, cinematic, NOT dark/desaturated.
 *  - Massive bold text at the END only.
 */

type Clip = {
  src: string;
  startFrom: number;
  duration: number; // in frames at 30fps
};

// Edit timeline — ordered for visual rhythm and emotional arc
// Starts intimate/solo → builds through training → peaks with game action
const clips: Clip[] = [
  // OPENING — intimate, solo training
  { src: "flag-football-night.mp4", startFrom: 0, duration: 60 },
  { src: "silhouette-stretch.mp4", startFrom: 10, duration: 35 },
  { src: "runner-start.mp4", startFrom: 20, duration: 40 },

  // BUILDING — the grind, training alone
  { src: "pushups.mp4", startFrom: 5, duration: 30 },
  { src: "football-warmup.mp4", startFrom: 30, duration: 35 },
  { src: "bench-multishot.mp4", startFrom: 0, duration: 40 },
  { src: "warmup.mp4", startFrom: 20, duration: 30 },
  { src: "silhouette-water.mp4", startFrom: 40, duration: 35 },

  // RISING — faster cuts, sport-specific
  { src: "basketball-dribble.mp4", startFrom: 60, duration: 30 },
  { src: "football-jumps.mp4", startFrom: 10, duration: 28 },
  { src: "qb-pass.mp4", startFrom: 0, duration: 25 },
  { src: "tennis-match.mp4", startFrom: 30, duration: 28 },
  { src: "soccer-goal.mp4", startFrom: 15, duration: 30 },
  { src: "football-portrait.mp4", startFrom: 0, duration: 35 },

  // CLIMAX — explosive, fast
  { src: "basketball-dunk.mp4", startFrom: 10, duration: 25 },
  { src: "bench-simple.mp4", startFrom: 0, duration: 30 },
  { src: "athlete-coach.mp4", startFrom: 30, duration: 30 },
  { src: "cheerleaders.mp4", startFrom: 15, duration: 28 },

  // PEAK — rapid fire
  { src: "basketball-dribble.mp4", startFrom: 120, duration: 18 },
  { src: "soccer-goal.mp4", startFrom: 45, duration: 18 },
  { src: "football-jumps.mp4", startFrom: 50, duration: 18 },
  { src: "basketball-dunk.mp4", startFrom: 30, duration: 18 },
  { src: "runner-start.mp4", startFrom: 80, duration: 20 },
  { src: "flag-football-night.mp4", startFrom: 90, duration: 30 },
];

const ENDCARD_DURATION = 120; // 4 seconds

export const NexusPromo: React.FC = () => {
  // Calculate total footage duration
  let totalClipFrames = 0;
  clips.forEach((c) => (totalClipFrames += c.duration));

  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Footage montage — hard cuts, no overlays */}
      {clips.map((clip, i) => {
        const from = offset;
        offset += clip.duration;

        return (
          <Sequence key={i} from={from} durationInFrames={clip.duration}>
            <HardCutClip
              src={clip.src}
              startFrom={clip.startFrom}
              index={i}
              totalClips={clips.length}
            />
          </Sequence>
        );
      })}

      {/* Black beat before end card */}
      <Sequence
        from={totalClipFrames}
        durationInFrames={10}
      >
        <AbsoluteFill style={{ backgroundColor: "#000" }} />
      </Sequence>

      {/* End card: SOIS LE NEX. + NEXUS */}
      <Sequence
        from={totalClipFrames + 10}
        durationInFrames={ENDCARD_DURATION}
      >
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};

/**
 * Each clip: natural color, slight cinematic warmth, subtle zoom.
 * No vignettes, no heavy grading. Let the footage be the footage.
 */
const HardCutClip: React.FC<{
  src: string;
  startFrom: number;
  index: number;
  totalClips: number;
}> = ({ src, startFrom, index, totalClips }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Very subtle slow zoom — barely noticeable, adds life
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.03], {
    extrapolateRight: "clamp",
  });

  // Fade from black only on the very first clip
  const fadeIn =
    index === 0
      ? interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" })
      : 1;

  // Fade to black only on the very last clip
  const fadeOut =
    index === totalClips - 1
      ? interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {
          extrapolateRight: "clamp",
        })
      : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", opacity: fadeIn * fadeOut }}>
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          // Light cinematic grade: slight warmth, subtle contrast
          filter: "contrast(1.08) saturate(0.92) brightness(0.95)",
        }}
      >
        <Video
          src={staticFile(src)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          startFrom={startFrom}
          volume={0}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * End card — Nike-style massive bold text.
 * "SOIS LE NEX." fills the screen, then NEXUS logo.
 */
const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // SOIS LE NEX. — slams in immediately
  const sloganOpacity = interpolate(frame, [0, 3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // SOIS LE NEX. holds, then fades
  const sloganFade = interpolate(frame, [55, 65], [1, 0], {
    extrapolateRight: "clamp",
  });

  // NEXUS logo appears after slogan
  const logoOpacity = interpolate(frame, [68, 73], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Final fade to black
  const curtain = interpolate(frame, [100, 120], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* SOIS LE NEX. — massive, bold, fills the screen */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: sloganOpacity * sloganFade,
        }}
      >
        <div
          style={{
            fontSize: 180,
            fontWeight: 900,
            fontFamily: "Impact, Arial Narrow, Helvetica Neue, sans-serif",
            color: colors.accent,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            lineHeight: 0.95,
            textAlign: "center",
            padding: "0 40px",
          }}
        >
          SOIS
          <br />
          LE NEX.
        </div>
      </AbsoluteFill>

      {/* NEXUS logo — clean, centered */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity: logoOpacity,
          gap: 15,
        }}
      >
        <div
          style={{
            fontSize: 90,
            fontWeight: 800,
            fontFamily: fonts.heading,
            color: "#fff",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          NEXUS
        </div>
        <div
          style={{
            width: 50,
            height: 3,
            backgroundColor: colors.accent,
          }}
        />
      </AbsoluteFill>

      {/* Final black curtain */}
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: curtain }} />
    </AbsoluteFill>
  );
};
