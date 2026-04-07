import React from "react";
import { z } from "zod";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  Sequence,
  Series,
  staticFile,
  spring,
} from "remotion";
import { Audio, Video } from "@remotion/media";
import { loadFont } from "@remotion/google-fonts/Inter";
import { colors } from "./styles";

// Load Inter font properly — blocks rendering until ready
const { fontFamily } = loadFont();

export const nexusSchema = z.object({});

/**
 * NEXUS PROMO — Nike "Why Do It" style
 *
 * Best practices applied:
 *  - Video/Audio from @remotion/media
 *  - Series for sequential clip layout
 *  - premountFor on sequences for smooth playback
 *  - calculateMetadata for audio-driven duration
 *  - Google Fonts loaded via @remotion/google-fonts
 *  - trimBefore (seconds) instead of startFrom (frames)
 *  - Proper spring configs
 */

type Clip = {
  src: string;
  trimBefore: number; // in seconds
  durationInFrames: number;
};

// Edit timeline — paced to match ~80s voiceover
const clips: Clip[] = [
  // --- VO Part 1: Flag football alone at night (0:00–0:22) ---
  { src: "flag-football-night.mp4", trimBefore: 0, durationInFrames: 120 },
  { src: "silhouette-stretch.mp4", trimBefore: 0.2, durationInFrames: 75 },
  { src: "runner-start.mp4", trimBefore: 0.5, durationInFrames: 80 },
  { src: "warmup.mp4", trimBefore: 0.7, durationInFrames: 70 },
  { src: "silhouette-water.mp4", trimBefore: 0.3, durationInFrames: 75 },
  { src: "flag-football-night.mp4", trimBefore: 3.3, durationInFrames: 60 },
  { src: "football-portrait.mp4", trimBefore: 0, durationInFrames: 90 },

  // --- VO Part 2: Basketball / gym / alone (0:25–0:53) ---
  { src: "basketball-dribble.mp4", trimBefore: 1, durationInFrames: 70 },
  { src: "basketball-dunk.mp4", trimBefore: 0.2, durationInFrames: 55 },
  { src: "football-warmup.mp4", trimBefore: 0.7, durationInFrames: 65 },
  { src: "pushups.mp4", trimBefore: 0.2, durationInFrames: 50 },
  { src: "football-jumps.mp4", trimBefore: 0.3, durationInFrames: 55 },
  { src: "qb-pass.mp4", trimBefore: 0, durationInFrames: 45 },
  { src: "tennis-match.mp4", trimBefore: 1, durationInFrames: 55 },
  { src: "soccer-goal.mp4", trimBefore: 0.5, durationInFrames: 50 },
  { src: "basketball-dribble.mp4", trimBefore: 3.3, durationInFrames: 45 },
  { src: "football-jumps.mp4", trimBefore: 1.7, durationInFrames: 40 },
  { src: "basketball-dunk.mp4", trimBefore: 1, durationInFrames: 40 },

  // --- VO Part 3: Bench, phone, change coming (0:56–1:19) ---
  { src: "bench-multishot.mp4", trimBefore: 0, durationInFrames: 90 },
  { src: "bench-simple.mp4", trimBefore: 0, durationInFrames: 70 },
  { src: "silhouette-water.mp4", trimBefore: 2, durationInFrames: 65 },
  { src: "athlete-coach.mp4", trimBefore: 0.7, durationInFrames: 75 },
  { src: "cheerleaders.mp4", trimBefore: 0.3, durationInFrames: 65 },
  { src: "runner-start.mp4", trimBefore: 2.3, durationInFrames: 55 },
  { src: "soccer-goal.mp4", trimBefore: 1.7, durationInFrames: 50 },
  { src: "basketball-dunk.mp4", trimBefore: 0.5, durationInFrames: 45 },
  { src: "flag-football-night.mp4", trimBefore: 2, durationInFrames: 70 },
];

const BEAT_FRAMES = 15;
const ENDCARD_FRAMES = 150;

export const NexusPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Total footage frames
  let totalClipFrames = 0;
  clips.forEach((c) => (totalClipFrames += c.durationInFrames));

  const endcardStart = totalClipFrames + BEAT_FRAMES;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* VOICEOVER */}
      <Audio src={staticFile("voiceover.mp3")} volume={1} />

      {/* FOOTAGE MONTAGE — using Series for sequential layout */}
      <Series>
        {clips.map((clip, i) => (
          <Series.Sequence
            key={`clip-${i}`}
            durationInFrames={clip.durationInFrames}
            premountFor={90} // preload 3s before appearance
          >
            <CinematicClip
              src={clip.src}
              trimBefore={clip.trimBefore}
              index={i}
              totalClips={clips.length}
            />
          </Series.Sequence>
        ))}
      </Series>

      {/* UNIFIED FILM GRADE — on top of all footage */}
      <Sequence from={0} durationInFrames={totalClipFrames}>
        <FilmGrade />
      </Sequence>

      {/* BLACK BEAT before end card */}
      <Sequence from={totalClipFrames} durationInFrames={BEAT_FRAMES}>
        <AbsoluteFill style={{ backgroundColor: "#000" }} />
      </Sequence>

      {/* END CARD */}
      <Sequence from={endcardStart} durationInFrames={ENDCARD_FRAMES}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};

/**
 * Each clip with unified cinematic grade.
 * Uses @remotion/media Video with trimBefore.
 */
const CinematicClip: React.FC<{
  src: string;
  trimBefore: number;
  index: number;
  totalClips: number;
}> = ({ src, trimBefore, index, totalClips }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  // Subtle slow zoom — Ken Burns
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.04], {
    extrapolateRight: "clamp",
  });

  // Fade from black on first clip only
  const fadeIn =
    index === 0
      ? interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" })
      : 1;

  // Fade to black on last clip only
  const fadeOut =
    index === totalClips - 1
      ? interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], {
          extrapolateRight: "clamp",
        })
      : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", opacity: fadeIn * fadeOut }}>
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          filter: "contrast(1.1) saturate(0.88) brightness(0.93)",
        }}
      >
        <Video
          src={staticFile(src)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          trimBefore={trimBefore}
          volume={0}
          pauseWhenBuffering
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * Unified film grade overlay.
 */
const FilmGrade: React.FC = () => (
  <>
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, rgba(20,15,8,0.15) 0%, rgba(10,8,5,0.1) 50%, rgba(15,12,8,0.2) 100%)",
        mixBlendMode: "multiply",
      }}
    />
    <AbsoluteFill
      style={{
        opacity: 0.04,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "200px 200px",
        mixBlendMode: "overlay",
      }}
    />
  </>
);

/**
 * End card — SOIS LE NEX. then NEXUS.
 * Using recommended spring configs from best practices.
 */
const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // SOIS LE NEX. slams in — snappy spring
  const sloganScale = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 200 }, // "snappy" preset
  });

  const sloganOpacity = interpolate(frame, [0, 3], [0, 1], {
    extrapolateRight: "clamp",
  });
  const sloganFade = interpolate(frame, [65, 75], [1, 0], {
    extrapolateRight: "clamp",
  });

  // NEXUS logo — smooth spring
  const logoProgress = spring({
    frame: Math.max(0, frame - 78),
    fps,
    config: { damping: 200 }, // "smooth" preset
  });

  const logoOpacity = interpolate(frame, [78, 83], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Final curtain
  const curtain = interpolate(frame, [120, 150], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* SOIS LE NEX. */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: sloganOpacity * sloganFade,
          transform: `scale(${sloganScale})`,
        }}
      >
        <div
          style={{
            fontSize: 200,
            fontWeight: 900,
            fontFamily: "Impact, Arial Narrow, Helvetica Neue, sans-serif",
            color: colors.accent,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            lineHeight: 0.92,
            textAlign: "center",
          }}
        >
          SOIS
          <br />
          LE NEX.
        </div>
      </AbsoluteFill>

      {/* NEXUS logo */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity: logoOpacity,
          transform: `translateY(${interpolate(logoProgress, [0, 1], [15, 0])}px)`,
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 90,
            fontWeight: 800,
            fontFamily: fontFamily,
            color: "#fff",
            letterSpacing: "0.12em",
          }}
        >
          NEXUS
        </div>
        <div
          style={{
            width: interpolate(logoProgress, [0, 1], [0, 50]),
            height: 3,
            backgroundColor: colors.accent,
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill style={{ backgroundColor: "#000", opacity: curtain }} />
    </AbsoluteFill>
  );
};
